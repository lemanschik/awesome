import MagicString, { SourceMap } from 'magic-string';
import { getTrackedPluginCache } from './PluginCache';
import { collapseSourcemap } from './collapseSourcemaps';
import { decodedSourcemap } from './decodedSourcemap';
import { augmentCodeLocation, error, errorInvalidSetAssetSourceCall, errorNoTransformMapOrAstWithoutCode, errorPluginError } from './error';
export default async function transform(source, module, pluginDriver, warn) {
    const id = module.id;
    const sourcemapChain = [];
    let originalSourcemap = source.map === null ? null : decodedSourcemap(source.map);
    const originalCode = source.code;
    let ast = source.ast;
    const transformDependencies = [];
    const emittedFiles = [];
    let customTransformCache = false;
    const useCustomTransformCache = () => (customTransformCache = true);
    let pluginName = '';
    const currentSource = source.code;
    function transformReducer(previousCode, result, plugin) {
        let code;
        let map;
        if (typeof result === 'string') {
            code = result;
        }
        else if (result && typeof result === 'object') {
            module.updateOptions(result);
            if (result.code == null) {
                if (result.map || result.ast) {
                    warn(errorNoTransformMapOrAstWithoutCode(plugin.name));
                }
                return previousCode;
            }
            ({ code, map, ast } = result);
        }
        else {
            return previousCode;
        }
        // strict null check allows 'null' maps to not be pushed to the chain,
        // while 'undefined' gets the missing map warning
        if (map !== null) {
            sourcemapChain.push(decodedSourcemap(typeof map === 'string' ? JSON.parse(map) : map) || {
                missing: true,
                plugin: plugin.name
            });
        }
        return code;
    }
    let code;
    try {
        code = await pluginDriver.hookReduceArg0('transform', [currentSource, id], transformReducer, (pluginContext, plugin) => {
            pluginName = plugin.name;
            return {
                ...pluginContext,
                addWatchFile(id) {
                    transformDependencies.push(id);
                    pluginContext.addWatchFile(id);
                },
                cache: customTransformCache
                    ? pluginContext.cache
                    : getTrackedPluginCache(pluginContext.cache, useCustomTransformCache),
                emitFile(emittedFile) {
                    emittedFiles.push(emittedFile);
                    return pluginDriver.emitFile(emittedFile);
                },
                error(error_, pos) {
                    if (typeof error_ === 'string')
                        error_ = { message: error_ };
                    if (pos)
                        augmentCodeLocation(error_, pos, currentSource, id);
                    error_.id = id;
                    error_.hook = 'transform';
                    return pluginContext.error(error_);
                },
                getCombinedSourcemap() {
                    const combinedMap = collapseSourcemap(id, originalCode, originalSourcemap, sourcemapChain, warn);
                    if (!combinedMap) {
                        const magicString = new MagicString(originalCode);
                        return magicString.generateMap({ hires: true, includeContent: true, source: id });
                    }
                    if (originalSourcemap !== combinedMap) {
                        originalSourcemap = combinedMap;
                        sourcemapChain.length = 0;
                    }
                    return new SourceMap({
                        ...combinedMap,
                        file: null,
                        sourcesContent: combinedMap.sourcesContent
                    });
                },
                setAssetSource() {
                    return this.error(errorInvalidSetAssetSourceCall());
                },
                warn(warning, pos) {
                    if (typeof warning === 'string')
                        warning = { message: warning };
                    if (pos)
                        augmentCodeLocation(warning, pos, currentSource, id);
                    warning.id = id;
                    warning.hook = 'transform';
                    pluginContext.warn(warning);
                }
            };
        });
    }
    catch (error_) {
        return error(errorPluginError(error_, pluginName, { hook: 'transform', id }));
    }
    if (!customTransformCache && // files emitted by a transform hook need to be emitted again if the hook is skipped
        emittedFiles.length > 0)
        module.transformFiles = emittedFiles;
    return {
        ast,
        code,
        customTransformCache,
        originalCode,
        originalSourcemap,
        sourcemapChain,
        transformDependencies
    };
}
