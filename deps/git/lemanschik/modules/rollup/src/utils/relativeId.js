import { relative } from '../../browser/src/path';
import { basename, dirname, extname, isAbsolute, normalize, resolve } from './path';
export function getAliasName(id) {
    const base = basename(id);
    return base.slice(0, Math.max(0, base.length - extname(id).length));
}
export default function relativeId(id) {
    if (!isAbsolute(id))
        return id;
    return relative(resolve(), id);
}
export function isPathFragment(name) {
    // starting with "/", "./", "../", "C:/"
    return (name[0] === '/' || (name[0] === '.' && (name[1] === '/' || name[1] === '.')) || isAbsolute(name));
}
const UPPER_DIR_REGEX = /^(\.\.\/)*\.\.$/;
export function getImportPath(importerId, targetPath, stripJsExtension, ensureFileName) {
    let relativePath = normalize(relative(dirname(importerId), targetPath));
    if (stripJsExtension && relativePath.endsWith('.js')) {
        relativePath = relativePath.slice(0, -3);
    }
    if (ensureFileName) {
        if (relativePath === '')
            return '../' + basename(targetPath);
        if (UPPER_DIR_REGEX.test(relativePath)) {
            return [...relativePath.split('/'), '..', basename(targetPath)].join('/');
        }
    }
    return !relativePath ? '.' : relativePath.startsWith('..') ? relativePath : './' + relativePath;
}
