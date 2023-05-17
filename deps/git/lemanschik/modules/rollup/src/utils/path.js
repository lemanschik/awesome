const ABSOLUTE_PATH_REGEX = /^(?:\/|(?:[A-Za-z]:)?[/\\|])/;
const RELATIVE_PATH_REGEX = /^\.?\.(\/|$)/;
export function isAbsolute(path) {
    return ABSOLUTE_PATH_REGEX.test(path);
}
export function isRelative(path) {
    return RELATIVE_PATH_REGEX.test(path);
}
const BACKSLASH_REGEX = /\\/g;
export function normalize(path) {
    return path.replace(BACKSLASH_REGEX, '/');
}
export { basename, dirname, extname, relative, resolve } from 'node:path';
