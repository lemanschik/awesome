import { promises as fs } from './fs';
import { basename, dirname, isAbsolute, resolve } from './path';
import { resolveIdViaPlugins } from './resolveIdViaPlugins';
export async function resolveId(source, importer, preserveSymlinks, pluginDriver, moduleLoaderResolveId, skip, customOptions, isEntry, assertions) {
    const pluginResult = await resolveIdViaPlugins(source, importer, pluginDriver, moduleLoaderResolveId, skip, customOptions, isEntry, assertions);
    if (pluginResult != null)
        return pluginResult;
    // external modules (non-entry modules that start with neither '.' or '/')
    // are skipped at this stage.
    if (importer !== undefined && !isAbsolute(source) && source[0] !== '.')
        return null;
    // `resolve` processes paths from right to left, prepending them until an
    // absolute path is created. Absolute importees therefore shortcircuit the
    // resolve call and require no special handing on our part.
    // See https://nodejs.org/api/path.html#path_path_resolve_paths
    return addJsExtensionIfNecessary(importer ? resolve(dirname(importer), source) : resolve(source), preserveSymlinks);
}
async function addJsExtensionIfNecessary(file, preserveSymlinks) {
    return ((await findFile(file, preserveSymlinks)) ??
        (await findFile(file + '.mjs', preserveSymlinks)) ??
        (await findFile(file + '.js', preserveSymlinks)));
}
async function findFile(file, preserveSymlinks) {
    try {
        const stats = await fs.lstat(file);
        if (!preserveSymlinks && stats.isSymbolicLink())
            return await findFile(await fs.realpath(file), preserveSymlinks);
        if ((preserveSymlinks && stats.isSymbolicLink()) || stats.isFile()) {
            // check case
            const name = basename(file);
            const files = await fs.readdir(dirname(file));
            if (files.includes(name))
                return file;
        }
    }
    catch {
        // suppress
    }
}
