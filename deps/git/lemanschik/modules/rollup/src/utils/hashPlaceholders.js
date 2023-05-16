import { toBase64 } from './base64';
import { error, errorFailedValidation } from './error';
// Four random characters from the private use area to minimize risk of conflicts
const hashPlaceholderLeft = '!~{';
const hashPlaceholderRight = '}~';
const hashPlaceholderOverhead = hashPlaceholderLeft.length + hashPlaceholderRight.length;
// This is the size of a sha256
export const maxHashSize = 64;
export const defaultHashSize = 8;
export const getHashPlaceholderGenerator = () => {
    let nextIndex = 0;
    return (optionName, hashSize = defaultHashSize) => {
        if (hashSize > maxHashSize) {
            return error(errorFailedValidation(`Hashes cannot be longer than ${maxHashSize} characters, received ${hashSize}. Check the "${optionName}" option.`));
        }
        const placeholder = `${hashPlaceholderLeft}${toBase64(++nextIndex).padStart(hashSize - hashPlaceholderOverhead, '0')}${hashPlaceholderRight}`;
        if (placeholder.length > hashSize) {
            return error(errorFailedValidation(`To generate hashes for this number of chunks (currently ${nextIndex}), you need a minimum hash size of ${placeholder.length}, received ${hashSize}. Check the "${optionName}" option.`));
        }
        return placeholder;
    };
};
const REPLACER_REGEX = new RegExp(`${hashPlaceholderLeft}[0-9a-zA-Z_$]{1,${maxHashSize - hashPlaceholderOverhead}}${hashPlaceholderRight}`, 'g');
export const replacePlaceholders = (code, hashesByPlaceholder) => code.replace(REPLACER_REGEX, placeholder => hashesByPlaceholder.get(placeholder) || placeholder);
export const replaceSinglePlaceholder = (code, placeholder, value) => code.replace(REPLACER_REGEX, match => (match === placeholder ? value : match));
export const replacePlaceholdersWithDefaultAndGetContainedPlaceholders = (code, placeholders) => {
    const containedPlaceholders = new Set();
    const transformedCode = code.replace(REPLACER_REGEX, placeholder => {
        if (placeholders.has(placeholder)) {
            containedPlaceholders.add(placeholder);
            return `${hashPlaceholderLeft}${'0'.repeat(placeholder.length - hashPlaceholderOverhead)}${hashPlaceholderRight}`;
        }
        return placeholder;
    });
    return { containedPlaceholders, transformedCode };
};
