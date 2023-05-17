import { locate } from 'locate-character';
import getCodeFrame from './getCodeFrame';
import { printQuotedStringList } from './printStringList';
import relativeId from './relativeId';
export function error(base) {
    if (!(base instanceof Error)) {
        base = Object.assign(new Error(base.message), base);
        Object.defineProperty(base, 'name', { value: 'RollupError' });
    }
    throw base;
}
export function augmentCodeLocation(properties, pos, source, id) {
    if (typeof pos === 'object') {
        const { line, column } = pos;
        properties.loc = { column, file: id, line };
    }
    else {
        properties.pos = pos;
        const { line, column } = locate(source, pos, { offsetLine: 1 });
        properties.loc = { column, file: id, line };
    }
    if (properties.frame === undefined) {
        const { line, column } = properties.loc;
        properties.frame = getCodeFrame(source, line, column);
    }
}
// Error codes should be sorted alphabetically while errors should be sorted by
// error code below
const ADDON_ERROR = 'ADDON_ERROR', ALREADY_CLOSED = 'ALREADY_CLOSED', AMBIGUOUS_EXTERNAL_NAMESPACES = 'AMBIGUOUS_EXTERNAL_NAMESPACES', ANONYMOUS_PLUGIN_CACHE = 'ANONYMOUS_PLUGIN_CACHE', ASSET_NOT_FINALISED = 'ASSET_NOT_FINALISED', ASSET_NOT_FOUND = 'ASSET_NOT_FOUND', ASSET_SOURCE_ALREADY_SET = 'ASSET_SOURCE_ALREADY_SET', ASSET_SOURCE_MISSING = 'ASSET_SOURCE_MISSING', BAD_LOADER = 'BAD_LOADER', CANNOT_CALL_NAMESPACE = 'CANNOT_CALL_NAMESPACE', CANNOT_EMIT_FROM_OPTIONS_HOOK = 'CANNOT_EMIT_FROM_OPTIONS_HOOK', CHUNK_NOT_GENERATED = 'CHUNK_NOT_GENERATED', CHUNK_INVALID = 'CHUNK_INVALID', CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY', CIRCULAR_REEXPORT = 'CIRCULAR_REEXPORT', CYCLIC_CROSS_CHUNK_REEXPORT = 'CYCLIC_CROSS_CHUNK_REEXPORT', DEPRECATED_FEATURE = 'DEPRECATED_FEATURE', DUPLICATE_IMPORT_OPTIONS = 'DUPLICATE_IMPORT_OPTIONS', DUPLICATE_PLUGIN_NAME = 'DUPLICATE_PLUGIN_NAME', EMPTY_BUNDLE = 'EMPTY_BUNDLE', EVAL = 'EVAL', EXTERNAL_SYNTHETIC_EXPORTS = 'EXTERNAL_SYNTHETIC_EXPORTS', FAIL_AFTER_WARNINGS = 'FAIL_AFTER_WARNINGS', FILE_NAME_CONFLICT = 'FILE_NAME_CONFLICT', FILE_NOT_FOUND = 'FILE_NOT_FOUND', ILLEGAL_IDENTIFIER_AS_NAME = 'ILLEGAL_IDENTIFIER_AS_NAME', ILLEGAL_REASSIGNMENT = 'ILLEGAL_REASSIGNMENT', INCONSISTENT_IMPORT_ASSERTIONS = 'INCONSISTENT_IMPORT_ASSERTIONS', INPUT_HOOK_IN_OUTPUT_PLUGIN = 'INPUT_HOOK_IN_OUTPUT_PLUGIN', INVALID_CHUNK = 'INVALID_CHUNK', INVALID_CONFIG_MODULE_FORMAT = 'INVALID_CONFIG_MODULE_FORMAT', INVALID_EXPORT_OPTION = 'INVALID_EXPORT_OPTION', INVALID_EXTERNAL_ID = 'INVALID_EXTERNAL_ID', INVALID_OPTION = 'INVALID_OPTION', INVALID_PLUGIN_HOOK = 'INVALID_PLUGIN_HOOK', INVALID_ROLLUP_PHASE = 'INVALID_ROLLUP_PHASE', INVALID_SETASSETSOURCE = 'INVALID_SETASSETSOURCE', INVALID_TLA_FORMAT = 'INVALID_TLA_FORMAT', MISSING_CONFIG = 'MISSING_CONFIG', MISSING_EXPORT = 'MISSING_EXPORT', MISSING_EXTERNAL_CONFIG = 'MISSING_EXTERNAL_CONFIG', MISSING_GLOBAL_NAME = 'MISSING_GLOBAL_NAME', MISSING_IMPLICIT_DEPENDANT = 'MISSING_IMPLICIT_DEPENDANT', MISSING_NAME_OPTION_FOR_IIFE_EXPORT = 'MISSING_NAME_OPTION_FOR_IIFE_EXPORT', MISSING_NODE_BUILTINS = 'MISSING_NODE_BUILTINS', MISSING_OPTION = 'MISSING_OPTION', MIXED_EXPORTS = 'MIXED_EXPORTS', MODULE_LEVEL_DIRECTIVE = 'MODULE_LEVEL_DIRECTIVE', NAMESPACE_CONFLICT = 'NAMESPACE_CONFLICT', NO_FS_IN_BROWSER = 'NO_FS_IN_BROWSER', NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE = 'NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE', ONLY_INLINE_SOURCEMAPS = 'ONLY_INLINE_SOURCEMAPS', PARSE_ERROR = 'PARSE_ERROR', PLUGIN_ERROR = 'PLUGIN_ERROR', SHIMMED_EXPORT = 'SHIMMED_EXPORT', SOURCEMAP_BROKEN = 'SOURCEMAP_BROKEN', SOURCEMAP_ERROR = 'SOURCEMAP_ERROR', SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT = 'SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT', THIS_IS_UNDEFINED = 'THIS_IS_UNDEFINED', UNEXPECTED_NAMED_IMPORT = 'UNEXPECTED_NAMED_IMPORT', UNKNOWN_OPTION = 'UNKNOWN_OPTION', UNRESOLVED_ENTRY = 'UNRESOLVED_ENTRY', UNRESOLVED_IMPORT = 'UNRESOLVED_IMPORT', UNUSED_EXTERNAL_IMPORT = 'UNUSED_EXTERNAL_IMPORT', VALIDATION_ERROR = 'VALIDATION_ERROR';
export function errorAddonNotGenerated(message, hook, plugin) {
    return {
        code: ADDON_ERROR,
        message: `Could not retrieve "${hook}". Check configuration of plugin "${plugin}".
\tError Message: ${message}`
    };
}
export function errorAlreadyClosed() {
    return {
        code: ALREADY_CLOSED,
        message: 'Bundle is already closed, no more calls to "generate" or "write" are allowed.'
    };
}
export function errorAmbiguousExternalNamespaces(binding, reexportingModule, usedModule, sources) {
    return {
        binding,
        code: AMBIGUOUS_EXTERNAL_NAMESPACES,
        ids: sources,
        message: `Ambiguous external namespace resolution: "${relativeId(reexportingModule)}" re-exports "${binding}" from one of the external modules ${printQuotedStringList(sources.map(module => relativeId(module)))}, guessing "${relativeId(usedModule)}".`,
        reexporter: reexportingModule
    };
}
export function errorAnonymousPluginCache() {
    return {
        code: ANONYMOUS_PLUGIN_CACHE,
        message: 'A plugin is trying to use the Rollup cache but is not declaring a plugin name or cacheKey.'
    };
}
export function errorAssetNotFinalisedForFileName(name) {
    return {
        code: ASSET_NOT_FINALISED,
        message: `Plugin error - Unable to get file name for asset "${name}". Ensure that the source is set and that generate is called first. If you reference assets via import.meta.ROLLUP_FILE_URL_<referenceId>, you need to either have set their source after "renderStart" or need to provide an explicit "fileName" when emitting them.`
    };
}
export function errorAssetReferenceIdNotFoundForSetSource(assetReferenceId) {
    return {
        code: ASSET_NOT_FOUND,
        message: `Plugin error - Unable to set the source for unknown asset "${assetReferenceId}".`
    };
}
export function errorAssetSourceAlreadySet(name) {
    return {
        code: ASSET_SOURCE_ALREADY_SET,
        message: `Unable to set the source for asset "${name}", source already set.`
    };
}
export function errorNoAssetSourceSet(assetName) {
    return {
        code: ASSET_SOURCE_MISSING,
        message: `Plugin error creating asset "${assetName}" - no asset source set.`
    };
}
export function errorBadLoader(id) {
    return {
        code: BAD_LOADER,
        message: `Error loading "${relativeId(id)}": plugin load hook should return a string, a { code, map } object, or nothing/null.`
    };
}
export function errorCannotCallNamespace(name) {
    return {
        code: CANNOT_CALL_NAMESPACE,
        message: `Cannot call a namespace ("${name}").`
    };
}
export function errorCannotEmitFromOptionsHook() {
    return {
        code: CANNOT_EMIT_FROM_OPTIONS_HOOK,
        message: `Cannot emit files or set asset sources in the "outputOptions" hook, use the "renderStart" hook instead.`
    };
}
export function errorChunkNotGeneratedForFileName(name) {
    return {
        code: CHUNK_NOT_GENERATED,
        message: `Plugin error - Unable to get file name for emitted chunk "${name}". You can only get file names once chunks have been generated after the "renderStart" hook.`
    };
}
export function errorChunkInvalid({ fileName, code }, exception) {
    const errorProperties = {
        code: CHUNK_INVALID,
        message: `Chunk "${fileName}" is not valid JavaScript: ${exception.message}.`
    };
    augmentCodeLocation(errorProperties, exception.loc, code, fileName);
    return errorProperties;
}
export function errorCircularDependency(cyclePath) {
    return {
        code: CIRCULAR_DEPENDENCY,
        ids: cyclePath,
        message: `Circular dependency: ${cyclePath.map(relativeId).join(' -> ')}`
    };
}
export function errorCircularReexport(exportName, exporter) {
    return {
        code: CIRCULAR_REEXPORT,
        exporter,
        message: `"${exportName}" cannot be exported from "${relativeId(exporter)}" as it is a reexport that references itself.`
    };
}
export function errorCyclicCrossChunkReexport(exportName, exporter, reexporter, importer) {
    return {
        code: CYCLIC_CROSS_CHUNK_REEXPORT,
        exporter,
        id: importer,
        message: `Export "${exportName}" of module "${relativeId(exporter)}" was reexported through module "${relativeId(reexporter)}" while both modules are dependencies of each other and will end up in different chunks by current Rollup settings. This scenario is not well supported at the moment as it will produce a circular dependency between chunks and will likely lead to broken execution order.\nEither change the import in "${relativeId(importer)}" to point directly to the exporting module or do not use "preserveModules" to ensure these modules end up in the same chunk.`,
        reexporter
    };
}
export function errorDeprecation(deprecation) {
    return {
        code: DEPRECATED_FEATURE,
        ...(typeof deprecation === 'string' ? { message: deprecation } : deprecation)
    };
}
export function errorDuplicateImportOptions() {
    return {
        code: DUPLICATE_IMPORT_OPTIONS,
        message: 'Either use --input, or pass input path as argument'
    };
}
export function errorDuplicatePluginName(plugin) {
    return {
        code: DUPLICATE_PLUGIN_NAME,
        message: `The plugin name ${plugin} is being used twice in the same build. Plugin names must be distinct or provide a cacheKey (please post an issue to the plugin if you are a plugin user).`
    };
}
export function errorEmptyChunk(chunkName) {
    return {
        code: EMPTY_BUNDLE,
        message: `Generated an empty chunk: "${chunkName}".`,
        names: [chunkName]
    };
}
export function errorEval(id) {
    return {
        code: EVAL,
        id,
        message: `Use of eval in "${relativeId(id)}" is strongly discouraged as it poses security risks and may cause issues with minification.`,
        url: 'https://rollupjs.org/guide/en/#avoiding-eval'
    };
}
export function errorExternalSyntheticExports(id, importer) {
    return {
        code: EXTERNAL_SYNTHETIC_EXPORTS,
        exporter: id,
        message: `External "${id}" cannot have "syntheticNamedExports" enabled (imported by "${relativeId(importer)}").`
    };
}
export function errorFailAfterWarnings() {
    return {
        code: FAIL_AFTER_WARNINGS,
        message: 'Warnings occurred and --failAfterWarnings flag present.'
    };
}
export function errorFileNameConflict(fileName) {
    return {
        code: FILE_NAME_CONFLICT,
        message: `The emitted file "${fileName}" overwrites a previously emitted file of the same name.`
    };
}
export function errorFileReferenceIdNotFoundForFilename(assetReferenceId) {
    return {
        code: FILE_NOT_FOUND,
        message: `Plugin error - Unable to get file name for unknown file "${assetReferenceId}".`
    };
}
export function errorIllegalIdentifierAsName(name) {
    return {
        code: ILLEGAL_IDENTIFIER_AS_NAME,
        message: `Given name "${name}" is not a legal JS identifier. If you need this, you can try "output.extend: true".`,
        url: 'https://rollupjs.org/guide/en/#outputextend'
    };
}
export function errorIllegalImportReassignment(name, importingId) {
    return {
        code: ILLEGAL_REASSIGNMENT,
        message: `Illegal reassignment of import "${name}" in "${relativeId(importingId)}".`
    };
}
export function errorInconsistentImportAssertions(existingAssertions, newAssertions, source, importer) {
    return {
        code: INCONSISTENT_IMPORT_ASSERTIONS,
        message: `Module "${relativeId(importer)}" tried to import "${relativeId(source)}" with ${formatAssertions(newAssertions)} assertions, but it was already imported elsewhere with ${formatAssertions(existingAssertions)} assertions. Please ensure that import assertions for the same module are always consistent.`
    };
}
const formatAssertions = (assertions) => {
    const entries = Object.entries(assertions);
    if (entries.length === 0)
        return 'no';
    return entries.map(([key, value]) => `"${key}": "${value}"`).join(', ');
};
export function errorInputHookInOutputPlugin(pluginName, hookName) {
    return {
        code: INPUT_HOOK_IN_OUTPUT_PLUGIN,
        message: `The "${hookName}" hook used by the output plugin ${pluginName} is a build time hook and will not be run for that plugin. Either this plugin cannot be used as an output plugin, or it should have an option to configure it as an output plugin.`
    };
}
export function errorCannotAssignModuleToChunk(moduleId, assignToAlias, currentAlias) {
    return {
        code: INVALID_CHUNK,
        message: `Cannot assign "${relativeId(moduleId)}" to the "${assignToAlias}" chunk as it is already in the "${currentAlias}" chunk.`
    };
}
export function errorCannotBundleConfigAsEsm(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Rollup transpiled your configuration to an  ES module even though it appears to contain CommonJS elements. To resolve this, you can pass the "--bundleConfigAsCjs" flag to Rollup or change your configuration to only contain valid ESM code.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: 'https://rollupjs.org/guide/en/#--bundleconfigascjs'
    };
}
export function errorCannotLoadConfigAsCjs(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Node tried to load your configuration file as CommonJS even though it is likely an ES module. To resolve this, change the extension of your configuration to ".mjs", set "type": "module" in your package.json file or pass the "--bundleConfigAsCjs" flag.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: 'https://rollupjs.org/guide/en/#--bundleconfigascjs'
    };
}
export function errorCannotLoadConfigAsEsm(originalError) {
    return {
        cause: originalError,
        code: INVALID_CONFIG_MODULE_FORMAT,
        message: `Node tried to load your configuration as an ES module even though it is likely CommonJS. To resolve this, change the extension of your configuration to ".cjs" or pass the "--bundleConfigAsCjs" flag.\n\nOriginal error: ${originalError.message}`,
        stack: originalError.stack,
        url: 'https://rollupjs.org/guide/en/#--bundleconfigascjs'
    };
}
export function errorInvalidExportOptionValue(optionValue) {
    return {
        code: INVALID_EXPORT_OPTION,
        message: `"output.exports" must be "default", "named", "none", "auto", or left unspecified (defaults to "auto"), received "${optionValue}".`,
        url: `https://rollupjs.org/guide/en/#outputexports`
    };
}
export function errorIncompatibleExportOptionValue(optionValue, keys, entryModule) {
    return {
        code: INVALID_EXPORT_OPTION,
        message: `"${optionValue}" was specified for "output.exports", but entry module "${relativeId(entryModule)}" has the following exports: ${printQuotedStringList(keys)}`,
        url: 'https://rollupjs.org/guide/en/#outputexports'
    };
}
export function errorInternalIdCannotBeExternal(source, importer) {
    return {
        code: INVALID_EXTERNAL_ID,
        message: `"${source}" is imported as an external by "${relativeId(importer)}", but is already an existing non-external module id.`
    };
}
export function errorInvalidOption(option, urlHash, explanation, value) {
    return {
        code: INVALID_OPTION,
        message: `Invalid value ${value !== undefined ? `${JSON.stringify(value)} ` : ''}for option "${option}" - ${explanation}.`,
        url: `https://rollupjs.org/guide/en/#${urlHash}`
    };
}
export function errorInvalidAddonPluginHook(hook, plugin) {
    return {
        code: INVALID_PLUGIN_HOOK,
        hook,
        message: `Error running plugin hook "${hook}" for plugin "${plugin}", expected a string, a function hook or an object with a "handler" string or function.`,
        plugin
    };
}
export function errorInvalidFunctionPluginHook(hook, plugin) {
    return {
        code: INVALID_PLUGIN_HOOK,
        hook,
        message: `Error running plugin hook "${hook}" for plugin "${plugin}", expected a function hook or an object with a "handler" function.`,
        plugin
    };
}
export function errorInvalidRollupPhaseForAddWatchFile() {
    return {
        code: INVALID_ROLLUP_PHASE,
        message: `Cannot call "addWatchFile" after the build has finished.`
    };
}
export function errorInvalidRollupPhaseForChunkEmission() {
    return {
        code: INVALID_ROLLUP_PHASE,
        message: `Cannot emit chunks after module loading has finished.`
    };
}
export function errorInvalidSetAssetSourceCall() {
    return {
        code: INVALID_SETASSETSOURCE,
        message: `setAssetSource cannot be called in transform for caching reasons. Use emitFile with a source, or call setAssetSource in another hook.`
    };
}
export function errorInvalidFormatForTopLevelAwait(id, format) {
    return {
        code: INVALID_TLA_FORMAT,
        id,
        message: `Module format "${format}" does not support top-level await. Use the "es" or "system" output formats rather.`
    };
}
export function errorMissingConfig() {
    return {
        code: MISSING_CONFIG,
        message: 'Config file must export an options object, or an array of options objects',
        url: 'https://rollupjs.org/guide/en/#configuration-files'
    };
}
export function errorMissingExport(binding, importingModule, exporter) {
    return {
        binding,
        code: MISSING_EXPORT,
        exporter,
        id: importingModule,
        message: `"${binding}" is not exported by "${relativeId(exporter)}", imported by "${relativeId(importingModule)}".`,
        url: `https://rollupjs.org/guide/en/#error-name-is-not-exported-by-module`
    };
}
export function errorMissingExternalConfig(file) {
    return {
        code: MISSING_EXTERNAL_CONFIG,
        message: `Could not resolve config file "${file}"`
    };
}
export function errorMissingGlobalName(externalId, guess) {
    return {
        code: MISSING_GLOBAL_NAME,
        id: externalId,
        message: `No name was provided for external module "${externalId}" in "output.globals" – guessing "${guess}".`,
        names: [guess],
        url: 'https://rollupjs.org/guide/en/#outputglobals'
    };
}
export function errorImplicitDependantCannotBeExternal(unresolvedId, implicitlyLoadedBefore) {
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(unresolvedId)}" that should be implicitly loaded before "${relativeId(implicitlyLoadedBefore)}" cannot be external.`
    };
}
export function errorUnresolvedImplicitDependant(unresolvedId, implicitlyLoadedBefore) {
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(unresolvedId)}" that should be implicitly loaded before "${relativeId(implicitlyLoadedBefore)}" could not be resolved.`
    };
}
export function errorImplicitDependantIsNotIncluded(module) {
    const implicitDependencies = [...module.implicitlyLoadedBefore]
        .map(dependency => relativeId(dependency.id))
        .sort();
    return {
        code: MISSING_IMPLICIT_DEPENDANT,
        message: `Module "${relativeId(module.id)}" that should be implicitly loaded before ${printQuotedStringList(implicitDependencies)} is not included in the module graph. Either it was not imported by an included module or only via a tree-shaken dynamic import, or no imported bindings were used and it had otherwise no side-effects.`
    };
}
export function errorMissingNameOptionForIifeExport() {
    return {
        code: MISSING_NAME_OPTION_FOR_IIFE_EXPORT,
        message: `If you do not supply "output.name", you may not be able to access the exports of an IIFE bundle.`,
        url: 'https://rollupjs.org/guide/en/#outputname'
    };
}
export function errorMissingNameOptionForUmdExport() {
    return {
        code: MISSING_NAME_OPTION_FOR_IIFE_EXPORT,
        message: 'You must supply "output.name" for UMD bundles that have exports so that the exports are accessible in environments without a module loader.',
        url: 'https://rollupjs.org/guide/en/#outputname'
    };
}
export function errorMissingNodeBuiltins(externalBuiltins) {
    return {
        code: MISSING_NODE_BUILTINS,
        ids: externalBuiltins,
        message: `Creating a browser bundle that depends on Node.js built-in modules (${printQuotedStringList(externalBuiltins)}). You might need to include https://github.com/FredKSchott/rollup-plugin-polyfill-node`
    };
}
// eslint-disable-next-line unicorn/prevent-abbreviations
export function errorMissingFileOrDirOption() {
    return {
        code: MISSING_OPTION,
        message: 'You must specify "output.file" or "output.dir" for the build.',
        url: 'https://rollupjs.org/guide/en/#outputdir'
    };
}
export function errorMixedExport(facadeModuleId, name) {
    return {
        code: MIXED_EXPORTS,
        id: facadeModuleId,
        message: `Entry module "${relativeId(facadeModuleId)}" is using named and default exports together. Consumers of your bundle will have to use \`${name || 'chunk'}.default\` to access the default export, which may not be what you want. Use \`output.exports: "named"\` to disable this warning.`,
        url: `https://rollupjs.org/guide/en/#outputexports`
    };
}
export function errorModuleLevelDirective(directive, id) {
    return {
        code: MODULE_LEVEL_DIRECTIVE,
        id,
        message: `Module level directives cause errors when bundled, "${directive}" in "${relativeId(id)}" was ignored.`
    };
}
export function errorNamespaceConflict(binding, reexportingModuleId, sources) {
    return {
        binding,
        code: NAMESPACE_CONFLICT,
        ids: sources,
        message: `Conflicting namespaces: "${relativeId(reexportingModuleId)}" re-exports "${binding}" from one of the modules ${printQuotedStringList(sources.map(moduleId => relativeId(moduleId)))} (will be ignored).`,
        reexporter: reexportingModuleId
    };
}
export function errorNoFileSystemInBrowser(method) {
    return {
        code: NO_FS_IN_BROWSER,
        message: `Cannot access the file system (via "${method}") when using the browser build of Rollup. Make sure you supply a plugin with custom resolveId and load hooks to Rollup.`,
        url: 'https://rollupjs.org/guide/en/#a-simple-example'
    };
}
export function errorNoTransformMapOrAstWithoutCode(pluginName) {
    return {
        code: NO_TRANSFORM_MAP_OR_AST_WITHOUT_CODE,
        message: `The plugin "${pluginName}" returned a "map" or "ast" without returning ` +
            'a "code". This will be ignored.'
    };
}
export function errorOnlyInlineSourcemapsForStdout() {
    return {
        code: ONLY_INLINE_SOURCEMAPS,
        message: 'Only inline sourcemaps are supported when bundling to stdout.'
    };
}
export function errorParseError(error, moduleId) {
    let message = error.message.replace(/ \(\d+:\d+\)$/, '');
    if (moduleId.endsWith('.json')) {
        message += ' (Note that you need @rollup/plugin-json to import JSON files)';
    }
    else if (!moduleId.endsWith('.js')) {
        message += ' (Note that you need plugins to import files that are not JavaScript)';
    }
    return {
        cause: error,
        code: PARSE_ERROR,
        id: moduleId,
        message
    };
}
export function errorPluginError(error, plugin, { hook, id } = {}) {
    if (typeof error === 'string')
        error = { message: error };
    if (error.code && error.code !== PLUGIN_ERROR) {
        error.pluginCode = error.code;
    }
    error.code = PLUGIN_ERROR;
    error.plugin = plugin;
    if (hook) {
        error.hook = hook;
    }
    if (id) {
        error.id = id;
    }
    return error;
}
export function errorShimmedExport(id, binding) {
    return {
        binding,
        code: SHIMMED_EXPORT,
        exporter: id,
        message: `Missing export "${binding}" has been shimmed in module "${relativeId(id)}".`
    };
}
export function errorSourcemapBroken(plugin) {
    return {
        code: SOURCEMAP_BROKEN,
        message: `Sourcemap is likely to be incorrect: a plugin (${plugin}) was used to transform files, but didn't generate a sourcemap for the transformation. Consult the plugin documentation for help`,
        plugin,
        url: `https://rollupjs.org/guide/en/#warning-sourcemap-is-likely-to-be-incorrect`
    };
}
export function errorInvalidSourcemapForError(error, id, column, line, pos) {
    return {
        cause: error,
        code: SOURCEMAP_ERROR,
        id,
        loc: {
            column,
            file: id,
            line
        },
        message: `Error when using sourcemap for reporting an error: ${error.message}`,
        pos
    };
}
export function errorSyntheticNamedExportsNeedNamespaceExport(id, syntheticNamedExportsOption) {
    return {
        code: SYNTHETIC_NAMED_EXPORTS_NEED_NAMESPACE_EXPORT,
        exporter: id,
        message: `Module "${relativeId(id)}" that is marked with \`syntheticNamedExports: ${JSON.stringify(syntheticNamedExportsOption)}\` needs ${typeof syntheticNamedExportsOption === 'string' && syntheticNamedExportsOption !== 'default'
            ? `an explicit export named "${syntheticNamedExportsOption}"`
            : 'a default export'} that does not reexport an unresolved named export of the same module.`
    };
}
export function errorThisIsUndefined() {
    return {
        code: THIS_IS_UNDEFINED,
        message: `The 'this' keyword is equivalent to 'undefined' at the top level of an ES module, and has been rewritten`,
        url: `https://rollupjs.org/guide/en/#error-this-is-undefined`
    };
}
export function errorUnexpectedNamedImport(id, imported, isReexport) {
    const importType = isReexport ? 'reexport' : 'import';
    return {
        code: UNEXPECTED_NAMED_IMPORT,
        exporter: id,
        message: `The named export "${imported}" was ${importType}ed from the external module "${relativeId(id)}" even though its interop type is "defaultOnly". Either remove or change this ${importType} or change the value of the "output.interop" option.`,
        url: 'https://rollupjs.org/guide/en/#outputinterop'
    };
}
export function errorUnexpectedNamespaceReexport(id) {
    return {
        code: UNEXPECTED_NAMED_IMPORT,
        exporter: id,
        message: `There was a namespace "*" reexport from the external module "${relativeId(id)}" even though its interop type is "defaultOnly". This will be ignored as namespace reexports only reexport named exports. If this is not intended, either remove or change this reexport or change the value of the "output.interop" option.`,
        url: 'https://rollupjs.org/guide/en/#outputinterop'
    };
}
export function errorUnknownOption(optionType, unknownOptions, validOptions) {
    return {
        code: UNKNOWN_OPTION,
        message: `Unknown ${optionType}: ${unknownOptions.join(', ')}. Allowed options: ${validOptions.join(', ')}`
    };
}
export function errorEntryCannotBeExternal(unresolvedId) {
    return {
        code: UNRESOLVED_ENTRY,
        message: `Entry module "${relativeId(unresolvedId)}" cannot be external.`
    };
}
export function errorUnresolvedEntry(unresolvedId) {
    return {
        code: UNRESOLVED_ENTRY,
        message: `Could not resolve entry module "${relativeId(unresolvedId)}".`
    };
}
export function errorUnresolvedImport(source, importer) {
    return {
        code: UNRESOLVED_IMPORT,
        exporter: source,
        id: importer,
        message: `Could not resolve "${source}" from "${relativeId(importer)}"`
    };
}
export function errorUnresolvedImportTreatedAsExternal(source, importer) {
    return {
        code: UNRESOLVED_IMPORT,
        exporter: source,
        id: importer,
        message: `"${source}" is imported by "${relativeId(importer)}", but could not be resolved – treating it as an external dependency.`,
        url: 'https://rollupjs.org/guide/en/#warning-treating-module-as-external-dependency'
    };
}
export function errorUnusedExternalImports(externalId, names, importers) {
    return {
        code: UNUSED_EXTERNAL_IMPORT,
        exporter: externalId,
        ids: importers,
        message: `${printQuotedStringList(names, [
            'is',
            'are'
        ])} imported from external module "${externalId}" but never used in ${printQuotedStringList(importers.map(importer => relativeId(importer)))}.`,
        names
    };
}
export function errorFailedValidation(message) {
    return {
        code: VALIDATION_ERROR,
        message
    };
}
export function warnDeprecation(deprecation, activeDeprecation, options) {
    warnDeprecationWithOptions(deprecation, activeDeprecation, options.onwarn, options.strictDeprecations);
}
export function warnDeprecationWithOptions(deprecation, activeDeprecation, warn, strictDeprecations) {
    if (activeDeprecation || strictDeprecations) {
        const warning = errorDeprecation(deprecation);
        if (strictDeprecations) {
            return error(warning);
        }
        warn(warning);
    }
}
