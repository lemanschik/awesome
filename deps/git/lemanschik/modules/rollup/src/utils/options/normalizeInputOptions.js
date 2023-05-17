import { importAssertions } from 'acorn-import-assertions';
import { EMPTY_ARRAY } from '../blank';
import { ensureArray } from '../ensureArray';
import { error, errorInvalidOption, warnDeprecationWithOptions } from '../error';
import { resolve } from '../path';
import relativeId from '../relativeId';
import { defaultOnWarn, getOptionWithPreset, normalizePluginOption, treeshakePresets, warnUnknownOptions } from './options';
export async function normalizeInputOptions(config) {
    // These are options that may trigger special warnings or behaviour later
    // if the user did not select an explicit value
    const unsetOptions = new Set();
    const context = config.context ?? 'undefined';
    const onwarn = getOnwarn(config);
    const strictDeprecations = config.strictDeprecations || false;
    const maxParallelFileOps = getmaxParallelFileOps(config, onwarn, strictDeprecations);
    const options = {
        acorn: getAcorn(config),
        acornInjectPlugins: getAcornInjectPlugins(config),
        cache: getCache(config),
        context,
        experimentalCacheExpiry: config.experimentalCacheExpiry ?? 10,
        external: getIdMatcher(config.external),
        inlineDynamicImports: getInlineDynamicImports(config, onwarn, strictDeprecations),
        input: getInput(config),
        makeAbsoluteExternalsRelative: config.makeAbsoluteExternalsRelative ?? 'ifRelativeSource',
        manualChunks: getManualChunks(config, onwarn, strictDeprecations),
        maxParallelFileOps,
        maxParallelFileReads: maxParallelFileOps,
        moduleContext: getModuleContext(config, context),
        onwarn,
        perf: config.perf || false,
        plugins: await normalizePluginOption(config.plugins),
        preserveEntrySignatures: config.preserveEntrySignatures ?? 'exports-only',
        preserveModules: getPreserveModules(config, onwarn, strictDeprecations),
        preserveSymlinks: config.preserveSymlinks || false,
        shimMissingExports: config.shimMissingExports || false,
        strictDeprecations,
        treeshake: getTreeshake(config)
    };
    warnUnknownOptions(config, [...Object.keys(options), 'watch'], 'input options', options.onwarn, /^(output)$/);
    return { options, unsetOptions };
}
const getOnwarn = (config) => {
    const { onwarn } = config;
    return onwarn
        ? warning => {
            warning.toString = () => {
                let warningString = '';
                if (warning.plugin)
                    warningString += `(${warning.plugin} plugin) `;
                if (warning.loc)
                    warningString += `${relativeId(warning.loc.file)} (${warning.loc.line}:${warning.loc.column}) `;
                warningString += warning.message;
                return warningString;
            };
            onwarn(warning, defaultOnWarn);
        }
        : defaultOnWarn;
};
const getAcorn = (config) => ({
    allowAwaitOutsideFunction: true,
    ecmaVersion: 'latest',
    preserveParens: false,
    sourceType: 'module',
    ...config.acorn
});
const getAcornInjectPlugins = (config) => [
    importAssertions,
    ...ensureArray(config.acornInjectPlugins)
];
const getCache = (config) => config.cache?.cache || config.cache;
const getIdMatcher = (option) => {
    if (option === true) {
        return () => true;
    }
    if (typeof option === 'function') {
        return (id, ...parameters) => (!id.startsWith('\0') && option(id, ...parameters)) || false;
    }
    if (option) {
        const ids = new Set();
        const matchers = [];
        for (const value of ensureArray(option)) {
            if (value instanceof RegExp) {
                matchers.push(value);
            }
            else {
                ids.add(value);
            }
        }
        return (id, ..._arguments) => ids.has(id) || matchers.some(matcher => matcher.test(id));
    }
    return () => false;
};
const getInlineDynamicImports = (config, warn, strictDeprecations) => {
    const configInlineDynamicImports = config.inlineDynamicImports;
    if (configInlineDynamicImports) {
        warnDeprecationWithOptions('The "inlineDynamicImports" option is deprecated. Use the "output.inlineDynamicImports" option instead.', true, warn, strictDeprecations);
    }
    return configInlineDynamicImports;
};
const getInput = (config) => {
    const configInput = config.input;
    return configInput == null ? [] : typeof configInput === 'string' ? [configInput] : configInput;
};
const getManualChunks = (config, warn, strictDeprecations) => {
    const configManualChunks = config.manualChunks;
    if (configManualChunks) {
        warnDeprecationWithOptions('The "manualChunks" option is deprecated. Use the "output.manualChunks" option instead.', true, warn, strictDeprecations);
    }
    return configManualChunks;
};
const getmaxParallelFileOps = (config, warn, strictDeprecations) => {
    const maxParallelFileReads = config.maxParallelFileReads;
    if (typeof maxParallelFileReads === 'number') {
        warnDeprecationWithOptions('The "maxParallelFileReads" option is deprecated. Use the "maxParallelFileOps" option instead.', true, warn, strictDeprecations);
    }
    const maxParallelFileOps = config.maxParallelFileOps ?? maxParallelFileReads;
    if (typeof maxParallelFileOps === 'number') {
        if (maxParallelFileOps <= 0)
            return Infinity;
        return maxParallelFileOps;
    }
    return 20;
};
const getModuleContext = (config, context) => {
    const configModuleContext = config.moduleContext;
    if (typeof configModuleContext === 'function') {
        return id => configModuleContext(id) ?? context;
    }
    if (configModuleContext) {
        const contextByModuleId = Object.create(null);
        for (const [key, moduleContext] of Object.entries(configModuleContext)) {
            contextByModuleId[resolve(key)] = moduleContext;
        }
        return id => contextByModuleId[id] || context;
    }
    return () => context;
};
const getPreserveModules = (config, warn, strictDeprecations) => {
    const configPreserveModules = config.preserveModules;
    if (configPreserveModules) {
        warnDeprecationWithOptions('The "preserveModules" option is deprecated. Use the "output.preserveModules" option instead.', true, warn, strictDeprecations);
    }
    return configPreserveModules;
};
const getTreeshake = (config) => {
    const configTreeshake = config.treeshake;
    if (configTreeshake === false) {
        return false;
    }
    const configWithPreset = getOptionWithPreset(config.treeshake, treeshakePresets, 'treeshake', 'false, true, ');
    return {
        annotations: configWithPreset.annotations !== false,
        correctVarValueBeforeDeclaration: configWithPreset.correctVarValueBeforeDeclaration === true,
        manualPureFunctions: configWithPreset.manualPureFunctions ?? EMPTY_ARRAY,
        moduleSideEffects: getHasModuleSideEffects(configWithPreset.moduleSideEffects),
        propertyReadSideEffects: configWithPreset.propertyReadSideEffects === 'always'
            ? 'always'
            : configWithPreset.propertyReadSideEffects !== false,
        tryCatchDeoptimization: configWithPreset.tryCatchDeoptimization !== false,
        unknownGlobalSideEffects: configWithPreset.unknownGlobalSideEffects !== false
    };
};
const getHasModuleSideEffects = (moduleSideEffectsOption) => {
    if (typeof moduleSideEffectsOption === 'boolean') {
        return () => moduleSideEffectsOption;
    }
    if (moduleSideEffectsOption === 'no-external') {
        return (_id, external) => !external;
    }
    if (typeof moduleSideEffectsOption === 'function') {
        return (id, external) => !id.startsWith('\0') ? moduleSideEffectsOption(id, external) !== false : true;
    }
    if (Array.isArray(moduleSideEffectsOption)) {
        const ids = new Set(moduleSideEffectsOption);
        return id => ids.has(id);
    }
    if (moduleSideEffectsOption) {
        error(errorInvalidOption('treeshake.moduleSideEffects', 'treeshake', 'please use one of false, "no-external", a function or an array'));
    }
    return () => true;
};
