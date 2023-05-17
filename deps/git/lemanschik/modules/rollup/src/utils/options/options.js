import { asyncFlatten } from '../asyncFlatten';
import { EMPTY_ARRAY } from '../blank';
import { error, errorInvalidOption, errorUnknownOption } from '../error';
import { printQuotedStringList } from '../printStringList';
export const defaultOnWarn = warning => console.warn(warning.message || warning);
export function warnUnknownOptions(passedOptions, validOptions, optionType, warn, ignoredKeys = /$./) {
    const validOptionSet = new Set(validOptions);
    const unknownOptions = Object.keys(passedOptions).filter(key => !(validOptionSet.has(key) || ignoredKeys.test(key)));
    if (unknownOptions.length > 0) {
        warn(errorUnknownOption(optionType, unknownOptions, [...validOptionSet].sort()));
    }
}
export const treeshakePresets = {
    recommended: {
        annotations: true,
        correctVarValueBeforeDeclaration: false,
        manualPureFunctions: EMPTY_ARRAY,
        moduleSideEffects: () => true,
        propertyReadSideEffects: true,
        tryCatchDeoptimization: true,
        unknownGlobalSideEffects: false
    },
    safest: {
        annotations: true,
        correctVarValueBeforeDeclaration: true,
        manualPureFunctions: EMPTY_ARRAY,
        moduleSideEffects: () => true,
        propertyReadSideEffects: true,
        tryCatchDeoptimization: true,
        unknownGlobalSideEffects: true
    },
    smallest: {
        annotations: true,
        correctVarValueBeforeDeclaration: false,
        manualPureFunctions: EMPTY_ARRAY,
        moduleSideEffects: () => false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false
    }
};
export const generatedCodePresets = {
    es2015: {
        arrowFunctions: true,
        constBindings: true,
        objectShorthand: true,
        reservedNamesAsProps: true,
        symbols: true
    },
    es5: {
        arrowFunctions: false,
        constBindings: false,
        objectShorthand: false,
        reservedNamesAsProps: true,
        symbols: false
    }
};
export const objectifyOption = (value) => value && typeof value === 'object' ? value : {};
export const objectifyOptionWithPresets = (presets, optionName, additionalValues) => (value) => {
    if (typeof value === 'string') {
        const preset = presets[value];
        if (preset) {
            return preset;
        }
        error(errorInvalidOption(optionName, getHashFromObjectOption(optionName), `valid values are ${additionalValues}${printQuotedStringList(Object.keys(presets))}. You can also supply an object for more fine-grained control`, value));
    }
    return objectifyOption(value);
};
export const getOptionWithPreset = (value, presets, optionName, additionalValues) => {
    const presetName = value?.preset;
    if (presetName) {
        const preset = presets[presetName];
        if (preset) {
            return { ...preset, ...value };
        }
        else {
            error(errorInvalidOption(`${optionName}.preset`, getHashFromObjectOption(optionName), `valid values are ${printQuotedStringList(Object.keys(presets))}`, presetName));
        }
    }
    return objectifyOptionWithPresets(presets, optionName, additionalValues)(value);
};
const getHashFromObjectOption = (optionName) => optionName.split('.').join('').toLowerCase();
export const normalizePluginOption = async (plugins) => (await asyncFlatten([plugins])).filter(Boolean);
