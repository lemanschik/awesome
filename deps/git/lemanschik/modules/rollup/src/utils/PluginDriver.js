import { FileEmitter } from './FileEmitter';
import { getPluginContext } from './PluginContext';
import { error, errorInputHookInOutputPlugin, errorInvalidAddonPluginHook, errorInvalidFunctionPluginHook, errorPluginError } from './error';
import { getOrCreate } from './getOrCreate';
// This will make sure no input hook is omitted
const inputHookNames = {
    buildEnd: 1,
    buildStart: 1,
    closeBundle: 1,
    closeWatcher: 1,
    load: 1,
    moduleParsed: 1,
    options: 1,
    resolveDynamicImport: 1,
    resolveId: 1,
    shouldTransformCachedModule: 1,
    transform: 1,
    watchChange: 1
};
const inputHooks = Object.keys(inputHookNames);
export class PluginDriver {
    constructor(graph, options, userPlugins, pluginCache, basePluginDriver) {
        this.graph = graph;
        this.options = options;
        this.pluginCache = pluginCache;
        this.sortedPlugins = new Map();
        this.unfulfilledActions = new Set();
        this.fileEmitter = new FileEmitter(graph, options, basePluginDriver && basePluginDriver.fileEmitter);
        this.emitFile = this.fileEmitter.emitFile.bind(this.fileEmitter);
        this.getFileName = this.fileEmitter.getFileName.bind(this.fileEmitter);
        this.finaliseAssets = this.fileEmitter.finaliseAssets.bind(this.fileEmitter);
        this.setChunkInformation = this.fileEmitter.setChunkInformation.bind(this.fileEmitter);
        this.setOutputBundle = this.fileEmitter.setOutputBundle.bind(this.fileEmitter);
        this.plugins = [...(basePluginDriver ? basePluginDriver.plugins : []), ...userPlugins];
        const existingPluginNames = new Set();
        this.pluginContexts = new Map(this.plugins.map(plugin => [
            plugin,
            getPluginContext(plugin, pluginCache, graph, options, this.fileEmitter, existingPluginNames)
        ]));
        if (basePluginDriver) {
            for (const plugin of userPlugins) {
                for (const hook of inputHooks) {
                    if (hook in plugin) {
                        options.onwarn(errorInputHookInOutputPlugin(plugin.name, hook));
                    }
                }
            }
        }
    }
    createOutputPluginDriver(plugins) {
        return new PluginDriver(this.graph, this.options, plugins, this.pluginCache, this);
    }
    getUnfulfilledHookActions() {
        return this.unfulfilledActions;
    }
    // chains, first non-null result stops and returns
    hookFirst(hookName, parameters, replaceContext, skipped) {
        let promise = Promise.resolve(null);
        for (const plugin of this.getSortedPlugins(hookName)) {
            if (skipped && skipped.has(plugin))
                continue;
            promise = promise.then(result => {
                if (result != null)
                    return result;
                return this.runHook(hookName, parameters, plugin, replaceContext);
            });
        }
        return promise;
    }
    // chains synchronously, first non-null result stops and returns
    hookFirstSync(hookName, parameters, replaceContext) {
        for (const plugin of this.getSortedPlugins(hookName)) {
            const result = this.runHookSync(hookName, parameters, plugin, replaceContext);
            if (result != null)
                return result;
        }
        return null;
    }
    // parallel, ignores returns
    async hookParallel(hookName, parameters, replaceContext) {
        const parallelPromises = [];
        for (const plugin of this.getSortedPlugins(hookName)) {
            if (plugin[hookName].sequential) {
                await Promise.all(parallelPromises);
                parallelPromises.length = 0;
                await this.runHook(hookName, parameters, plugin, replaceContext);
            }
            else {
                parallelPromises.push(this.runHook(hookName, parameters, plugin, replaceContext));
            }
        }
        await Promise.all(parallelPromises);
    }
    // chains, reduces returned value, handling the reduced value as the first hook argument
    hookReduceArg0(hookName, [argument0, ...rest], reduce, replaceContext) {
        let promise = Promise.resolve(argument0);
        for (const plugin of this.getSortedPlugins(hookName)) {
            promise = promise.then(argument0 => this.runHook(hookName, [argument0, ...rest], plugin, replaceContext).then(result => reduce.call(this.pluginContexts.get(plugin), argument0, result, plugin)));
        }
        return promise;
    }
    // chains synchronously, reduces returned value, handling the reduced value as the first hook argument
    hookReduceArg0Sync(hookName, [argument0, ...rest], reduce, replaceContext) {
        for (const plugin of this.getSortedPlugins(hookName)) {
            const parameters = [argument0, ...rest];
            const result = this.runHookSync(hookName, parameters, plugin, replaceContext);
            argument0 = reduce.call(this.pluginContexts.get(plugin), argument0, result, plugin);
        }
        return argument0;
    }
    // chains, reduces returned value to type string, handling the reduced value separately. permits hooks as values.
    async hookReduceValue(hookName, initialValue, parameters, reducer) {
        const results = [];
        const parallelResults = [];
        for (const plugin of this.getSortedPlugins(hookName, validateAddonPluginHandler)) {
            if (plugin[hookName].sequential) {
                results.push(...(await Promise.all(parallelResults)));
                parallelResults.length = 0;
                results.push(await this.runHook(hookName, parameters, plugin));
            }
            else {
                parallelResults.push(this.runHook(hookName, parameters, plugin));
            }
        }
        results.push(...(await Promise.all(parallelResults)));
        return results.reduce(reducer, await initialValue);
    }
    // chains synchronously, reduces returned value to type T, handling the reduced value separately. permits hooks as values.
    hookReduceValueSync(hookName, initialValue, parameters, reduce, replaceContext) {
        let accumulator = initialValue;
        for (const plugin of this.getSortedPlugins(hookName)) {
            const result = this.runHookSync(hookName, parameters, plugin, replaceContext);
            accumulator = reduce.call(this.pluginContexts.get(plugin), accumulator, result, plugin);
        }
        return accumulator;
    }
    // chains, ignores returns
    hookSeq(hookName, parameters, replaceContext) {
        let promise = Promise.resolve();
        for (const plugin of this.getSortedPlugins(hookName)) {
            promise = promise.then(() => this.runHook(hookName, parameters, plugin, replaceContext));
        }
        return promise.then(noReturn);
    }
    getSortedPlugins(hookName, validateHandler) {
        return getOrCreate(this.sortedPlugins, hookName, () => getSortedValidatedPlugins(hookName, this.plugins, validateHandler));
    }
    // Implementation signature
    runHook(hookName, parameters, plugin, replaceContext) {
        // We always filter for plugins that support the hook before running it
        const hook = plugin[hookName];
        const handler = typeof hook === 'object' ? hook.handler : hook;
        let context = this.pluginContexts.get(plugin);
        if (replaceContext) {
            context = replaceContext(context, plugin);
        }
        let action = null;
        return Promise.resolve()
            .then(() => {
            if (typeof handler !== 'function') {
                return handler;
            }
            // eslint-disable-next-line @typescript-eslint/ban-types
            const hookResult = handler.apply(context, parameters);
            if (!hookResult?.then) {
                // short circuit for non-thenables and non-Promises
                return hookResult;
            }
            // Track pending hook actions to properly error out when
            // unfulfilled promises cause rollup to abruptly and confusingly
            // exit with a successful 0 return code but without producing any
            // output, errors or warnings.
            action = [plugin.name, hookName, parameters];
            this.unfulfilledActions.add(action);
            // Although it would be more elegant to just return hookResult here
            // and put the .then() handler just above the .catch() handler below,
            // doing so would subtly change the defacto async event dispatch order
            // which at least one test and some plugins in the wild may depend on.
            return Promise.resolve(hookResult).then(result => {
                // action was fulfilled
                this.unfulfilledActions.delete(action);
                return result;
            });
        })
            .catch(error_ => {
            if (action !== null) {
                // action considered to be fulfilled since error being handled
                this.unfulfilledActions.delete(action);
            }
            return error(errorPluginError(error_, plugin.name, { hook: hookName }));
        });
    }
    /**
     * Run a sync plugin hook and return the result.
     * @param hookName Name of the plugin hook. Must be in `PluginHooks`.
     * @param args Arguments passed to the plugin hook.
     * @param plugin The acutal plugin
     * @param replaceContext When passed, the plugin context can be overridden.
     */
    runHookSync(hookName, parameters, plugin, replaceContext) {
        const hook = plugin[hookName];
        const handler = typeof hook === 'object' ? hook.handler : hook;
        let context = this.pluginContexts.get(plugin);
        if (replaceContext) {
            context = replaceContext(context, plugin);
        }
        try {
            // eslint-disable-next-line @typescript-eslint/ban-types
            return handler.apply(context, parameters);
        }
        catch (error_) {
            return error(errorPluginError(error_, plugin.name, { hook: hookName }));
        }
    }
}
export function getSortedValidatedPlugins(hookName, plugins, validateHandler = validateFunctionPluginHandler) {
    const pre = [];
    const normal = [];
    const post = [];
    for (const plugin of plugins) {
        const hook = plugin[hookName];
        if (hook) {
            if (typeof hook === 'object') {
                validateHandler(hook.handler, hookName, plugin);
                if (hook.order === 'pre') {
                    pre.push(plugin);
                    continue;
                }
                if (hook.order === 'post') {
                    post.push(plugin);
                    continue;
                }
            }
            else {
                validateHandler(hook, hookName, plugin);
            }
            normal.push(plugin);
        }
    }
    return [...pre, ...normal, ...post];
}
function validateFunctionPluginHandler(handler, hookName, plugin) {
    if (typeof handler !== 'function') {
        error(errorInvalidFunctionPluginHook(hookName, plugin.name));
    }
}
function validateAddonPluginHandler(handler, hookName, plugin) {
    if (typeof handler !== 'string' && typeof handler !== 'function') {
        return error(errorInvalidAddonPluginHook(hookName, plugin.name));
    }
}
function noReturn() { }
