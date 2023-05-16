import Chunk from './Chunk';
import ExternalChunk from './ExternalChunk';
import ExternalModule from './ExternalModule';
import Module from './Module';
import { getChunkAssignments } from './utils/chunkAssignment';
import commondir from './utils/commondir';
import { error, errorCannotAssignModuleToChunk, errorChunkInvalid, errorInvalidOption } from './utils/error';
import { sortByExecutionOrder } from './utils/executionOrder';
import { getGenerateCodeSnippets } from './utils/generateCodeSnippets';
import { getHashPlaceholderGenerator } from './utils/hashPlaceholders';
import { getOutputBundle } from './utils/outputBundle';
import { isAbsolute } from './utils/path';
import { renderChunks } from './utils/renderChunks';
import { timeEnd, timeStart } from './utils/timers';
export default class Bundle {
    constructor(outputOptions, unsetOptions, inputOptions, pluginDriver, graph) {
        this.outputOptions = outputOptions;
        this.unsetOptions = unsetOptions;
        this.inputOptions = inputOptions;
        this.pluginDriver = pluginDriver;
        this.graph = graph;
        this.facadeChunkByModule = new Map();
        this.includedNamespaces = new Set();
    }
    async generate(isWrite) {
        timeStart('GENERATE', 1);
        const outputBundleBase = Object.create(null);
        const outputBundle = getOutputBundle(outputBundleBase);
        this.pluginDriver.setOutputBundle(outputBundle, this.outputOptions);
        try {
            timeStart('initialize render', 2);
            await this.pluginDriver.hookParallel('renderStart', [this.outputOptions, this.inputOptions]);
            timeEnd('initialize render', 2);
            timeStart('generate chunks', 2);
            const getHashPlaceholder = getHashPlaceholderGenerator();
            const chunks = await this.generateChunks(outputBundle, getHashPlaceholder);
            if (chunks.length > 1) {
                validateOptionsForMultiChunkOutput(this.outputOptions, this.inputOptions.onwarn);
            }
            this.pluginDriver.setChunkInformation(this.facadeChunkByModule);
            for (const chunk of chunks) {
                chunk.generateExports();
            }
            timeEnd('generate chunks', 2);
            await renderChunks(chunks, outputBundle, this.pluginDriver, this.outputOptions, this.inputOptions.onwarn);
        }
        catch (error_) {
            await this.pluginDriver.hookParallel('renderError', [error_]);
            throw error_;
        }
        timeStart('generate bundle', 2);
        await this.pluginDriver.hookSeq('generateBundle', [
            this.outputOptions,
            outputBundle,
            isWrite
        ]);
        this.finaliseAssets(outputBundle);
        timeEnd('generate bundle', 2);
        timeEnd('GENERATE', 1);
        return outputBundleBase;
    }
    async addManualChunks(manualChunks) {
        const manualChunkAliasByEntry = new Map();
        const chunkEntries = await Promise.all(Object.entries(manualChunks).map(async ([alias, files]) => ({
            alias,
            entries: await this.graph.moduleLoader.addAdditionalModules(files)
        })));
        for (const { alias, entries } of chunkEntries) {
            for (const entry of entries) {
                addModuleToManualChunk(alias, entry, manualChunkAliasByEntry);
            }
        }
        return manualChunkAliasByEntry;
    }
    assignManualChunks(getManualChunk) {
        // eslint-disable-next-line unicorn/prefer-module
        const manualChunkAliasesWithEntry = [];
        const manualChunksApi = {
            getModuleIds: () => this.graph.modulesById.keys(),
            getModuleInfo: this.graph.getModuleInfo
        };
        for (const module of this.graph.modulesById.values()) {
            if (module instanceof Module) {
                const manualChunkAlias = getManualChunk(module.id, manualChunksApi);
                if (typeof manualChunkAlias === 'string') {
                    manualChunkAliasesWithEntry.push([manualChunkAlias, module]);
                }
            }
        }
        manualChunkAliasesWithEntry.sort(([aliasA], [aliasB]) => aliasA > aliasB ? 1 : aliasA < aliasB ? -1 : 0);
        const manualChunkAliasByEntry = new Map();
        for (const [alias, module] of manualChunkAliasesWithEntry) {
            addModuleToManualChunk(alias, module, manualChunkAliasByEntry);
        }
        return manualChunkAliasByEntry;
    }
    finaliseAssets(bundle) {
        if (this.outputOptions.validate) {
            for (const file of Object.values(bundle)) {
                if ('code' in file) {
                    try {
                        this.graph.contextParse(file.code, {
                            allowHashBang: true,
                            ecmaVersion: 'latest'
                        });
                    }
                    catch (error_) {
                        this.inputOptions.onwarn(errorChunkInvalid(file, error_));
                    }
                }
            }
        }
        this.pluginDriver.finaliseAssets();
    }
    async generateChunks(bundle, getHashPlaceholder) {
        const { experimentalMinChunkSize, inlineDynamicImports, manualChunks, preserveModules } = this.outputOptions;
        const manualChunkAliasByEntry = typeof manualChunks === 'object'
            ? await this.addManualChunks(manualChunks)
            : this.assignManualChunks(manualChunks);
        const snippets = getGenerateCodeSnippets(this.outputOptions);
        const includedModules = getIncludedModules(this.graph.modulesById);
        const inputBase = commondir(getAbsoluteEntryModulePaths(includedModules, preserveModules));
        const externalChunkByModule = getExternalChunkByModule(this.graph.modulesById, this.outputOptions, inputBase);
        const chunks = [];
        const chunkByModule = new Map();
        for (const { alias, modules } of inlineDynamicImports
            ? [{ alias: null, modules: includedModules }]
            : preserveModules
                ? includedModules.map(module => ({ alias: null, modules: [module] }))
                : getChunkAssignments(this.graph.entryModules, manualChunkAliasByEntry, experimentalMinChunkSize)) {
            sortByExecutionOrder(modules);
            const chunk = new Chunk(modules, this.inputOptions, this.outputOptions, this.unsetOptions, this.pluginDriver, this.graph.modulesById, chunkByModule, externalChunkByModule, this.facadeChunkByModule, this.includedNamespaces, alias, getHashPlaceholder, bundle, inputBase, snippets);
            chunks.push(chunk);
        }
        for (const chunk of chunks) {
            chunk.link();
        }
        const facades = [];
        for (const chunk of chunks) {
            facades.push(...chunk.generateFacades());
        }
        return [...chunks, ...facades];
    }
}
function validateOptionsForMultiChunkOutput(outputOptions, onWarn) {
    if (outputOptions.format === 'umd' || outputOptions.format === 'iife')
        return error(errorInvalidOption('output.format', 'outputformat', 'UMD and IIFE output formats are not supported for code-splitting builds', outputOptions.format));
    if (typeof outputOptions.file === 'string')
        return error(errorInvalidOption('output.file', 'outputdir', 'when building multiple chunks, the "output.dir" option must be used, not "output.file". To inline dynamic imports, set the "inlineDynamicImports" option'));
    if (outputOptions.sourcemapFile)
        return error(errorInvalidOption('output.sourcemapFile', 'outputsourcemapfile', '"output.sourcemapFile" is only supported for single-file builds'));
    if (!outputOptions.amd.autoId && outputOptions.amd.id)
        onWarn(errorInvalidOption('output.amd.id', 'outputamd', 'this option is only properly supported for single-file builds. Use "output.amd.autoId" and "output.amd.basePath" instead'));
}
function getIncludedModules(modulesById) {
    const includedModules = [];
    for (const module of modulesById.values()) {
        if (module instanceof Module &&
            (module.isIncluded() || module.info.isEntry || module.includedDynamicImporters.length > 0)) {
            includedModules.push(module);
        }
    }
    return includedModules;
}
function getAbsoluteEntryModulePaths(includedModules, preserveModules) {
    const absoluteEntryModulePaths = [];
    for (const module of includedModules) {
        if ((module.info.isEntry || preserveModules) && isAbsolute(module.id)) {
            absoluteEntryModulePaths.push(module.id);
        }
    }
    return absoluteEntryModulePaths;
}
function getExternalChunkByModule(modulesById, outputOptions, inputBase) {
    const externalChunkByModule = new Map();
    for (const module of modulesById.values()) {
        if (module instanceof ExternalModule) {
            externalChunkByModule.set(module, new ExternalChunk(module, outputOptions, inputBase));
        }
    }
    return externalChunkByModule;
}
function addModuleToManualChunk(alias, module, manualChunkAliasByEntry) {
    const existingAlias = manualChunkAliasByEntry.get(module);
    if (typeof existingAlias === 'string' && existingAlias !== alias) {
        return error(errorCannotAssignModuleToChunk(module.id, alias, existingAlias));
    }
    manualChunkAliasByEntry.set(module, alias);
}
