import { error, errorFailedValidation } from './error';
import { lowercaseBundleKeys } from './outputBundle';
import { extname } from './path';
import { isPathFragment } from './relativeId';
export function renderNamePattern(pattern, patternName, replacements) {
    if (isPathFragment(pattern))
        return error(errorFailedValidation(`Invalid pattern "${pattern}" for "${patternName}", patterns can be neither absolute nor relative paths. If you want your files to be stored in a subdirectory, write its name without a leading slash like this: subdirectory/pattern.`));
    return pattern.replace(/\[(\w+)(:\d+)?]/g, (_match, type, size) => {
        if (!replacements.hasOwnProperty(type) || (size && type !== 'hash')) {
            return error(errorFailedValidation(`"[${type}${size || ''}]" is not a valid placeholder in the "${patternName}" pattern.`));
        }
        const replacement = replacements[type](size && Number.parseInt(size.slice(1)));
        if (isPathFragment(replacement))
            return error(errorFailedValidation(`Invalid substitution "${replacement}" for placeholder "[${type}]" in "${patternName}" pattern, can be neither absolute nor relative path.`));
        return replacement;
    });
}
export function makeUnique(name, { [lowercaseBundleKeys]: reservedLowercaseBundleKeys }) {
    if (!reservedLowercaseBundleKeys.has(name.toLowerCase()))
        return name;
    const extension = extname(name);
    name = name.slice(0, Math.max(0, name.length - extension.length));
    let uniqueName, uniqueIndex = 1;
    while (reservedLowercaseBundleKeys.has((uniqueName = name + ++uniqueIndex + extension).toLowerCase()))
        ;
    return uniqueName;
}
