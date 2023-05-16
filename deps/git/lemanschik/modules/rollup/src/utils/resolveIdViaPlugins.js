import { BLANK, EMPTY_OBJECT } from './blank';
export function resolveIdViaPlugins(source, importer, pluginDriver, moduleLoaderResolveId, skip, customOptions, isEntry, assertions) {
    let skipped = null;
    let replaceContext = null;
    if (skip) {
        skipped = new Set();
        for (const skippedCall of skip) {
            if (source === skippedCall.source && importer === skippedCall.importer) {
                skipped.add(skippedCall.plugin);
            }
        }
        replaceContext = (pluginContext, plugin) => ({
            ...pluginContext,
            resolve: (source, importer, { assertions, custom, isEntry, skipSelf } = BLANK) => moduleLoaderResolveId(source, importer, custom, isEntry, assertions || EMPTY_OBJECT, skipSelf ? [...skip, { importer, plugin, source }] : skip)
        });
    }
    return pluginDriver.hookFirst('resolveId', [source, importer, { assertions, custom: customOptions, isEntry }], replaceContext, skipped);
}
