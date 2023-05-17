import { error, errorInvalidExportOptionValue, errorInvalidOption, warnDeprecation } from '../error';
import { resolve } from '../path';
import { sanitizeFileName as defaultSanitizeFileName } from '../sanitizeFileName';
import { isValidUrl } from '../url';
import { generatedCodePresets, getOptionWithPreset, normalizePluginOption, warnUnknownOptions } from './options';
export async function normalizeOutputOptions(config, inputOptions, unsetInputOptions) {
    // These are options that may trigger special warnings or behaviour later
    // if the user did not select an explicit value
    const unsetOptions = new Set(unsetInputOptions);
    const compact = config.compact || false;
    const format = getFormat(config);
    const inlineDynamicImports = getInlineDynamicImports(config, inputOptions);
    const preserveModules = getPreserveModules(config, inlineDynamicImports, inputOptions);
    const file = getFile(config, preserveModules, inputOptions);
    const preferConst = getPreferConst(config, inputOptions);
    const generatedCode = getGeneratedCode(config, preferConst);
    const outputOptions = {
        amd: getAmd(config),
        assetFileNames: config.assetFileNames ?? 'assets/[name]-[hash][extname]',
        banner: getAddon(config, 'banner'),
        chunkFileNames: config.chunkFileNames ?? '[name]-[hash].js',
        compact,
        dir: getDir(config, file),
        dynamicImportFunction: getDynamicImportFunction(config, inputOptions, format),
        dynamicImportInCjs: config.dynamicImportInCjs ?? true,
        entryFileNames: getEntryFileNames(config, unsetOptions),
        esModule: config.esModule ?? 'if-default-prop',
        experimentalMinChunkSize: config.experimentalMinChunkSize || 0,
        exports: getExports(config, unsetOptions),
        extend: config.extend || false,
        externalImportAssertions: config.externalImportAssertions ?? true,
        externalLiveBindings: config.externalLiveBindings ?? true,
        file,
        footer: getAddon(config, 'footer'),
        format,
        freeze: config.freeze ?? true,
        generatedCode,
        globals: config.globals || {},
        hoistTransitiveImports: config.hoistTransitiveImports ?? true,
        indent: getIndent(config, compact),
        inlineDynamicImports,
        interop: getInterop(config),
        intro: getAddon(config, 'intro'),
        manualChunks: getManualChunks(config, inlineDynamicImports, preserveModules, inputOptions),
        minifyInternalExports: getMinifyInternalExports(config, format, compact),
        name: config.name,
        namespaceToStringTag: getNamespaceToStringTag(config, generatedCode, inputOptions),
        noConflict: config.noConflict || false,
        outro: getAddon(config, 'outro'),
        paths: config.paths || {},
        plugins: await normalizePluginOption(config.plugins),
        preferConst,
        preserveModules,
        preserveModulesRoot: getPreserveModulesRoot(config),
        sanitizeFileName: typeof config.sanitizeFileName === 'function'
            ? config.sanitizeFileName
            : config.sanitizeFileName === false
                ? id => id
                : defaultSanitizeFileName,
        sourcemap: config.sourcemap || false,
        sourcemapBaseUrl: getSourcemapBaseUrl(config),
        sourcemapExcludeSources: config.sourcemapExcludeSources || false,
        sourcemapFile: config.sourcemapFile,
        sourcemapPathTransform: config.sourcemapPathTransform,
        strict: config.strict ?? true,
        systemNullSetters: config.systemNullSetters ?? true,
        validate: config.validate || false
    };
    warnUnknownOptions(config, Object.keys(outputOptions), 'output options', inputOptions.onwarn);
    return { options: outputOptions, unsetOptions };
}
const getFile = (config, preserveModules, inputOptions) => {
    const { file } = config;
    if (typeof file === 'string') {
        if (preserveModules) {
            return error(errorInvalidOption('output.file', 'outputdir', 'you must set "output.dir" instead of "output.file" when using the "output.preserveModules" option'));
        }
        if (!Array.isArray(inputOptions.input))
            return error(errorInvalidOption('output.file', 'outputdir', 'you must set "output.dir" instead of "output.file" when providing named inputs'));
    }
    return file;
};
const getFormat = (config) => {
    const configFormat = config.format;
    switch (configFormat) {
        case undefined:
        case 'es':
        case 'esm':
        case 'module': {
            return 'es';
        }
        case 'cjs':
        case 'commonjs': {
            return 'cjs';
        }
        case 'system':
        case 'systemjs': {
            return 'system';
        }
        case 'amd':
        case 'iife':
        case 'umd': {
            return configFormat;
        }
        default: {
            return error({
                message: `You must specify "output.format", which can be one of "amd", "cjs", "system", "es", "iife" or "umd".`,
                url: `https://rollupjs.org/guide/en/#outputformat`
            });
        }
    }
};
const getInlineDynamicImports = (config, inputOptions) => {
    const inlineDynamicImports = (config.inlineDynamicImports ?? inputOptions.inlineDynamicImports) || false;
    const { input } = inputOptions;
    if (inlineDynamicImports && (Array.isArray(input) ? input : Object.keys(input)).length > 1) {
        return error(errorInvalidOption('output.inlineDynamicImports', 'outputinlinedynamicimports', 'multiple inputs are not supported when "output.inlineDynamicImports" is true'));
    }
    return inlineDynamicImports;
};
const getPreserveModules = (config, inlineDynamicImports, inputOptions) => {
    const preserveModules = (config.preserveModules ?? inputOptions.preserveModules) || false;
    if (preserveModules) {
        if (inlineDynamicImports) {
            return error(errorInvalidOption('output.inlineDynamicImports', 'outputinlinedynamicimports', `this option is not supported for "output.preserveModules"`));
        }
        if (inputOptions.preserveEntrySignatures === false) {
            return error(errorInvalidOption('preserveEntrySignatures', 'preserveentrysignatures', 'setting this option to false is not supported for "output.preserveModules"'));
        }
    }
    return preserveModules;
};
const getPreferConst = (config, inputOptions) => {
    const configPreferConst = config.preferConst;
    if (configPreferConst != null) {
        warnDeprecation(`The "output.preferConst" option is deprecated. Use the "output.generatedCode.constBindings" option instead.`, true, inputOptions);
    }
    return !!configPreferConst;
};
const getPreserveModulesRoot = (config) => {
    const { preserveModulesRoot } = config;
    if (preserveModulesRoot === null || preserveModulesRoot === undefined) {
        return undefined;
    }
    return resolve(preserveModulesRoot);
};
const getAmd = (config) => {
    const mergedOption = {
        autoId: false,
        basePath: '',
        define: 'define',
        forceJsExtensionForImports: false,
        ...config.amd
    };
    if ((mergedOption.autoId || mergedOption.basePath) && mergedOption.id) {
        return error(errorInvalidOption('output.amd.id', 'outputamd', 'this option cannot be used together with "output.amd.autoId"/"output.amd.basePath"'));
    }
    if (mergedOption.basePath && !mergedOption.autoId) {
        return error(errorInvalidOption('output.amd.basePath', 'outputamd', 'this option only works with "output.amd.autoId"'));
    }
    return mergedOption.autoId
        ? {
            autoId: true,
            basePath: mergedOption.basePath,
            define: mergedOption.define,
            forceJsExtensionForImports: mergedOption.forceJsExtensionForImports
        }
        : {
            autoId: false,
            define: mergedOption.define,
            forceJsExtensionForImports: mergedOption.forceJsExtensionForImports,
            id: mergedOption.id
        };
};
const getAddon = (config, name) => {
    const configAddon = config[name];
    if (typeof configAddon === 'function') {
        return configAddon;
    }
    return () => configAddon || '';
};
// eslint-disable-next-line unicorn/prevent-abbreviations
const getDir = (config, file) => {
    const { dir } = config;
    if (typeof dir === 'string' && typeof file === 'string') {
        return error(errorInvalidOption('output.dir', 'outputdir', 'you must set either "output.file" for a single-file build or "output.dir" when generating multiple chunks'));
    }
    return dir;
};
const getDynamicImportFunction = (config, inputOptions, format) => {
    const configDynamicImportFunction = config.dynamicImportFunction;
    if (configDynamicImportFunction) {
        warnDeprecation(`The "output.dynamicImportFunction" option is deprecated. Use the "renderDynamicImport" plugin hook instead.`, true, inputOptions);
        if (format !== 'es') {
            inputOptions.onwarn(errorInvalidOption('output.dynamicImportFunction', 'outputdynamicImportFunction', 'this option is ignored for formats other than "es"'));
        }
    }
    return configDynamicImportFunction;
};
const getEntryFileNames = (config, unsetOptions) => {
    const configEntryFileNames = config.entryFileNames;
    if (configEntryFileNames == null) {
        unsetOptions.add('entryFileNames');
    }
    return configEntryFileNames ?? '[name].js';
};
function getExports(config, unsetOptions) {
    const configExports = config.exports;
    if (configExports == null) {
        unsetOptions.add('exports');
    }
    else if (!['default', 'named', 'none', 'auto'].includes(configExports)) {
        return error(errorInvalidExportOptionValue(configExports));
    }
    return configExports || 'auto';
}
const getGeneratedCode = (config, preferConst) => {
    const configWithPreset = getOptionWithPreset(config.generatedCode, generatedCodePresets, 'output.generatedCode', '');
    return {
        arrowFunctions: configWithPreset.arrowFunctions === true,
        constBindings: configWithPreset.constBindings === true || preferConst,
        objectShorthand: configWithPreset.objectShorthand === true,
        reservedNamesAsProps: configWithPreset.reservedNamesAsProps !== false,
        symbols: configWithPreset.symbols === true
    };
};
const getIndent = (config, compact) => {
    if (compact) {
        return '';
    }
    const configIndent = config.indent;
    return configIndent === false ? '' : configIndent ?? true;
};
const ALLOWED_INTEROP_TYPES = new Set([
    'compat',
    'auto',
    'esModule',
    'default',
    'defaultOnly'
]);
const getInterop = (config) => {
    const configInterop = config.interop;
    if (typeof configInterop === 'function') {
        const interopPerId = Object.create(null);
        let defaultInterop = null;
        return id => id === null
            ? defaultInterop || validateInterop((defaultInterop = configInterop(id)))
            : id in interopPerId
                ? interopPerId[id]
                : validateInterop((interopPerId[id] = configInterop(id)));
    }
    return configInterop === undefined ? () => 'default' : () => validateInterop(configInterop);
};
const validateInterop = (interop) => {
    if (!ALLOWED_INTEROP_TYPES.has(interop)) {
        return error(errorInvalidOption('output.interop', 'outputinterop', 
        // eslint-disable-next-line unicorn/prefer-spread
        `use one of ${Array.from(ALLOWED_INTEROP_TYPES, value => JSON.stringify(value)).join(', ')}`, interop));
    }
    return interop;
};
const getManualChunks = (config, inlineDynamicImports, preserveModules, inputOptions) => {
    const configManualChunks = config.manualChunks || inputOptions.manualChunks;
    if (configManualChunks) {
        if (inlineDynamicImports) {
            return error(errorInvalidOption('output.manualChunks', 'outputmanualchunks', 'this option is not supported for "output.inlineDynamicImports"'));
        }
        if (preserveModules) {
            return error(errorInvalidOption('output.manualChunks', 'outputmanualchunks', 'this option is not supported for "output.preserveModules"'));
        }
    }
    return configManualChunks || {};
};
const getMinifyInternalExports = (config, format, compact) => config.minifyInternalExports ?? (compact || format === 'es' || format === 'system');
const getNamespaceToStringTag = (config, generatedCode, inputOptions) => {
    const configNamespaceToStringTag = config.namespaceToStringTag;
    if (configNamespaceToStringTag != null) {
        warnDeprecation(`The "output.namespaceToStringTag" option is deprecated. Use the "output.generatedCode.symbols" option instead.`, true, inputOptions);
        return configNamespaceToStringTag;
    }
    return generatedCode.symbols || false;
};
const getSourcemapBaseUrl = (config) => {
    const { sourcemapBaseUrl } = config;
    if (sourcemapBaseUrl) {
        if (isValidUrl(sourcemapBaseUrl)) {
            return sourcemapBaseUrl;
        }
        return error(errorInvalidOption('output.sourcemapBaseUrl', 'outputsourcemapbaseurl', `must be a valid URL, received ${JSON.stringify(sourcemapBaseUrl)}`));
    }
};
