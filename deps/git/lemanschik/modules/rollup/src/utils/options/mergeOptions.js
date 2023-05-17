import { ensureArray } from '../ensureArray';
import { defaultOnWarn, generatedCodePresets, normalizePluginOption, objectifyOption, objectifyOptionWithPresets, treeshakePresets, warnUnknownOptions } from './options';
export const commandAliases = {
    c: 'config',
    d: 'dir',
    e: 'external',
    f: 'format',
    g: 'globals',
    h: 'help',
    i: 'input',
    m: 'sourcemap',
    n: 'name',
    o: 'file',
    p: 'plugin',
    v: 'version',
    w: 'watch'
};
const EMPTY_COMMAND_OPTIONS = { external: [], globals: undefined };
export async function mergeOptions(config, rawCommandOptions = EMPTY_COMMAND_OPTIONS, defaultOnWarnHandler = defaultOnWarn) {
    const command = getCommandOptions(rawCommandOptions);
    const inputOptions = await mergeInputOptions(config, command, defaultOnWarnHandler);
    const warn = inputOptions.onwarn;
    if (command.output) {
        Object.assign(command, command.output);
    }
    const outputOptionsArray = ensureArray(config.output);
    if (outputOptionsArray.length === 0)
        outputOptionsArray.push({});
    const outputOptions = await Promise.all(outputOptionsArray.map(singleOutputOptions => mergeOutputOptions(singleOutputOptions, command, warn)));
    warnUnknownOptions(command, [
        ...Object.keys(inputOptions),
        ...Object.keys(outputOptions[0]).filter(option => option !== 'sourcemapPathTransform'),
        ...Object.keys(commandAliases),
        'bundleConfigAsCjs',
        'config',
        'environment',
        'plugin',
        'silent',
        'failAfterWarnings',
        'stdin',
        'waitForBundleInput',
        'configPlugin'
    ], 'CLI flags', warn, /^_$|output$|config/);
    inputOptions.output = outputOptions;
    return inputOptions;
}
function getCommandOptions(rawCommandOptions) {
    const external = rawCommandOptions.external && typeof rawCommandOptions.external === 'string'
        ? rawCommandOptions.external.split(',')
        : [];
    return {
        ...rawCommandOptions,
        external,
        globals: typeof rawCommandOptions.globals === 'string'
            ? rawCommandOptions.globals.split(',').reduce((globals, globalDefinition) => {
                const [id, variableName] = globalDefinition.split(':');
                globals[id] = variableName;
                if (!external.includes(id)) {
                    external.push(id);
                }
                return globals;
            }, Object.create(null))
            : undefined
    };
}
async function mergeInputOptions(config, overrides, defaultOnWarnHandler) {
    const getOption = (name) => overrides[name] ?? config[name];
    const inputOptions = {
        acorn: getOption('acorn'),
        acornInjectPlugins: config.acornInjectPlugins,
        cache: config.cache,
        context: getOption('context'),
        experimentalCacheExpiry: getOption('experimentalCacheExpiry'),
        external: getExternal(config, overrides),
        inlineDynamicImports: getOption('inlineDynamicImports'),
        input: getOption('input') || [],
        makeAbsoluteExternalsRelative: getOption('makeAbsoluteExternalsRelative'),
        manualChunks: getOption('manualChunks'),
        maxParallelFileOps: getOption('maxParallelFileOps'),
        maxParallelFileReads: getOption('maxParallelFileReads'),
        moduleContext: getOption('moduleContext'),
        onwarn: getOnWarn(config, defaultOnWarnHandler),
        perf: getOption('perf'),
        plugins: await normalizePluginOption(config.plugins),
        preserveEntrySignatures: getOption('preserveEntrySignatures'),
        preserveModules: getOption('preserveModules'),
        preserveSymlinks: getOption('preserveSymlinks'),
        shimMissingExports: getOption('shimMissingExports'),
        strictDeprecations: getOption('strictDeprecations'),
        treeshake: getObjectOption(config, overrides, 'treeshake', objectifyOptionWithPresets(treeshakePresets, 'treeshake', 'false, true, ')),
        watch: getWatch(config, overrides)
    };
    warnUnknownOptions(config, Object.keys(inputOptions), 'input options', inputOptions.onwarn, /^output$/);
    return inputOptions;
}
const getExternal = (config, overrides) => {
    const configExternal = config.external;
    return typeof configExternal === 'function'
        ? (source, importer, isResolved) => configExternal(source, importer, isResolved) || overrides.external.includes(source)
        : [...ensureArray(configExternal), ...overrides.external];
};
const getOnWarn = (config, defaultOnWarnHandler) => config.onwarn ? warning => config.onwarn(warning, defaultOnWarnHandler) : defaultOnWarnHandler;
const getObjectOption = (config, overrides, name, objectifyValue = objectifyOption) => {
    const commandOption = normalizeObjectOptionValue(overrides[name], objectifyValue);
    const configOption = normalizeObjectOptionValue(config[name], objectifyValue);
    if (commandOption !== undefined) {
        return commandOption && { ...configOption, ...commandOption };
    }
    return configOption;
};
export const getWatch = (config, overrides) => config.watch !== false && getObjectOption(config, overrides, 'watch');
export const isWatchEnabled = (optionValue) => {
    if (Array.isArray(optionValue)) {
        return optionValue.reduce((result, value) => (typeof value === 'boolean' ? value : result), false);
    }
    return optionValue === true;
};
export const normalizeObjectOptionValue = (optionValue, objectifyValue) => {
    if (!optionValue) {
        return optionValue;
    }
    if (Array.isArray(optionValue)) {
        return optionValue.reduce((result, value) => value && result && { ...result, ...objectifyValue(value) }, {});
    }
    return objectifyValue(optionValue);
};
async function mergeOutputOptions(config, overrides, warn) {
    const getOption = (name) => overrides[name] ?? config[name];
    const outputOptions = {
        amd: getObjectOption(config, overrides, 'amd'),
        assetFileNames: getOption('assetFileNames'),
        banner: getOption('banner'),
        chunkFileNames: getOption('chunkFileNames'),
        compact: getOption('compact'),
        dir: getOption('dir'),
        dynamicImportFunction: getOption('dynamicImportFunction'),
        dynamicImportInCjs: getOption('dynamicImportInCjs'),
        entryFileNames: getOption('entryFileNames'),
        esModule: getOption('esModule'),
        experimentalMinChunkSize: getOption('experimentalMinChunkSize'),
        exports: getOption('exports'),
        extend: getOption('extend'),
        externalImportAssertions: getOption('externalImportAssertions'),
        externalLiveBindings: getOption('externalLiveBindings'),
        file: getOption('file'),
        footer: getOption('footer'),
        format: getOption('format'),
        freeze: getOption('freeze'),
        generatedCode: getObjectOption(config, overrides, 'generatedCode', objectifyOptionWithPresets(generatedCodePresets, 'output.generatedCode', '')),
        globals: getOption('globals'),
        hoistTransitiveImports: getOption('hoistTransitiveImports'),
        indent: getOption('indent'),
        inlineDynamicImports: getOption('inlineDynamicImports'),
        interop: getOption('interop'),
        intro: getOption('intro'),
        manualChunks: getOption('manualChunks'),
        minifyInternalExports: getOption('minifyInternalExports'),
        name: getOption('name'),
        namespaceToStringTag: getOption('namespaceToStringTag'),
        noConflict: getOption('noConflict'),
        outro: getOption('outro'),
        paths: getOption('paths'),
        plugins: await normalizePluginOption(config.plugins),
        preferConst: getOption('preferConst'),
        preserveModules: getOption('preserveModules'),
        preserveModulesRoot: getOption('preserveModulesRoot'),
        sanitizeFileName: getOption('sanitizeFileName'),
        sourcemap: getOption('sourcemap'),
        sourcemapBaseUrl: getOption('sourcemapBaseUrl'),
        sourcemapExcludeSources: getOption('sourcemapExcludeSources'),
        sourcemapFile: getOption('sourcemapFile'),
        sourcemapPathTransform: getOption('sourcemapPathTransform'),
        strict: getOption('strict'),
        systemNullSetters: getOption('systemNullSetters'),
        validate: getOption('validate')
    };
    warnUnknownOptions(config, Object.keys(outputOptions), 'output options', warn);
    return outputOptions;
}
