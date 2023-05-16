import { resolveIdViaPlugins } from '../../src/utils/resolveIdViaPlugins';
import { throwNoFileSystem } from './error';
export async function resolveId(source, importer, _preserveSymlinks, pluginDriver, moduleLoaderResolveId, skip, customOptions, isEntry, assertions) {
    const pluginResult = await resolveIdViaPlugins(source, importer, pluginDriver, moduleLoaderResolveId, skip, customOptions, isEntry, assertions);
    if (pluginResult == null) {
        throwNoFileSystem('path.resolve');
    }
    return pluginResult;
}
