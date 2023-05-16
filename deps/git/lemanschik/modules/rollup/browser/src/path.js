const ABSOLUTE_PATH_REGEX = /^(?:\/|(?:[A-Za-z]:)?[/\\|])/;
const RELATIVE_PATH_REGEX = /^\.?\.\//;
const ALL_BACKSLASHES_REGEX = /\\/g;
const ANY_SLASH_REGEX = /[/\\]/;
const EXTNAME_REGEX = /\.[^.]+$/;
export function isAbsolute(path) {
    return ABSOLUTE_PATH_REGEX.test(path);
}
export function isRelative(path) {
    return RELATIVE_PATH_REGEX.test(path);
}
export function normalize(path) {
    return path.replace(ALL_BACKSLASHES_REGEX, '/');
}
export function basename(path) {
    return path.split(ANY_SLASH_REGEX).pop() || '';
}
export function dirname(path) {
    const match = /[/\\][^/\\]*$/.exec(path);
    if (!match)
        return '.';
    const directory = path.slice(0, -match[0].length);
    // If `directory` is the empty string, we're at root.
    return directory || '/';
}
export function extname(path) {
    const match = EXTNAME_REGEX.exec(basename(path));
    return match ? match[0] : '';
}
export function relative(from, to) {
    const fromParts = from.split(ANY_SLASH_REGEX).filter(Boolean);
    const toParts = to.split(ANY_SLASH_REGEX).filter(Boolean);
    if (fromParts[0] === '.')
        fromParts.shift();
    if (toParts[0] === '.')
        toParts.shift();
    while (fromParts[0] && toParts[0] && fromParts[0] === toParts[0]) {
        fromParts.shift();
        toParts.shift();
    }
    while (toParts[0] === '..' && fromParts.length > 0) {
        toParts.shift();
        fromParts.pop();
    }
    while (fromParts.pop()) {
        toParts.unshift('..');
    }
    return toParts.join('/');
}
export function resolve(...paths) {
    const firstPathSegment = paths.shift();
    if (!firstPathSegment) {
        return '/';
    }
    let resolvedParts = firstPathSegment.split(ANY_SLASH_REGEX);
    for (const path of paths) {
        if (isAbsolute(path)) {
            resolvedParts = path.split(ANY_SLASH_REGEX);
        }
        else {
            const parts = path.split(ANY_SLASH_REGEX);
            while (parts[0] === '.' || parts[0] === '..') {
                const part = parts.shift();
                if (part === '..') {
                    resolvedParts.pop();
                }
            }
            resolvedParts.push(...parts);
        }
    }
    return resolvedParts.join('/');
}
