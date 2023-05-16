import { BuildPhase } from './buildPhase';
import { createHash } from './crypto';
import { error, errorAssetNotFinalisedForFileName, errorAssetReferenceIdNotFoundForSetSource, errorAssetSourceAlreadySet, errorChunkNotGeneratedForFileName, errorFailedValidation, errorFileNameConflict, errorFileReferenceIdNotFoundForFilename, errorInvalidRollupPhaseForChunkEmission, errorNoAssetSourceSet } from './error';
import { defaultHashSize } from './hashPlaceholders';
import { FILE_PLACEHOLDER, lowercaseBundleKeys } from './outputBundle';
import { extname } from './path';
import { isPathFragment } from './relativeId';
import { makeUnique, renderNamePattern } from './renderNamePattern';
function getSourceHash(source) {
    return createHash().update(source).digest('hex');
}
function generateAssetFileName(name, source, sourceHash, outputOptions, bundle) {
    const emittedName = outputOptions.sanitizeFileName(name || 'asset');
    return makeUnique(renderNamePattern(typeof outputOptions.assetFileNames === 'function'
        ? outputOptions.assetFileNames({ name, source, type: 'asset' })
        : outputOptions.assetFileNames, 'output.assetFileNames', {
        ext: () => extname(emittedName).slice(1),
        extname: () => extname(emittedName),
        hash: size => sourceHash.slice(0, Math.max(0, size || defaultHashSize)),
        name: () => emittedName.slice(0, Math.max(0, emittedName.length - extname(emittedName).length))
    }), bundle);
}
function reserveFileNameInBundle(fileName, { bundle }, warn) {
    if (bundle[lowercaseBundleKeys].has(fileName.toLowerCase())) {
        warn(errorFileNameConflict(fileName));
    }
    else {
        bundle[fileName] = FILE_PLACEHOLDER;
    }
}
function hasValidType(emittedFile) {
    return Boolean(emittedFile &&
        (emittedFile.type === 'asset' ||
            emittedFile.type === 'chunk'));
}
function hasValidName(emittedFile) {
    const validatedName = emittedFile.fileName || emittedFile.name;
    return !validatedName || (typeof validatedName === 'string' && !isPathFragment(validatedName));
}
function getValidSource(source, emittedFile, fileReferenceId) {
    if (!(typeof source === 'string' || source instanceof Uint8Array)) {
        const assetName = emittedFile.fileName || emittedFile.name || fileReferenceId;
        return error(errorFailedValidation(`Could not set source for ${typeof assetName === 'string' ? `asset "${assetName}"` : 'unnamed asset'}, asset source needs to be a string, Uint8Array or Buffer.`));
    }
    return source;
}
function getAssetFileName(file, referenceId) {
    if (typeof file.fileName !== 'string') {
        return error(errorAssetNotFinalisedForFileName(file.name || referenceId));
    }
    return file.fileName;
}
function getChunkFileName(file, facadeChunkByModule) {
    if (file.fileName) {
        return file.fileName;
    }
    if (facadeChunkByModule) {
        const chunk = facadeChunkByModule.get(file.module);
        return chunk.id || chunk.getFileName();
    }
    return error(errorChunkNotGeneratedForFileName(file.fileName || file.name));
}
export class FileEmitter {
    constructor(graph, options, baseFileEmitter) {
        this.graph = graph;
        this.options = options;
        this.facadeChunkByModule = null;
        this.nextIdBase = 1;
        this.output = null;
        this.emitFile = (emittedFile) => {
            if (!hasValidType(emittedFile)) {
                return error(errorFailedValidation(`Emitted files must be of type "asset" or "chunk", received "${emittedFile && emittedFile.type}".`));
            }
            if (!hasValidName(emittedFile)) {
                return error(errorFailedValidation(`The "fileName" or "name" properties of emitted files must be strings that are neither absolute nor relative paths, received "${emittedFile.fileName || emittedFile.name}".`));
            }
            if (emittedFile.type === 'chunk') {
                return this.emitChunk(emittedFile);
            }
            return this.emitAsset(emittedFile);
        };
        this.finaliseAssets = () => {
            for (const [referenceId, emittedFile] of this.filesByReferenceId) {
                if (emittedFile.type === 'asset' && typeof emittedFile.fileName !== 'string')
                    return error(errorNoAssetSourceSet(emittedFile.name || referenceId));
            }
        };
        this.getFileName = (fileReferenceId) => {
            const emittedFile = this.filesByReferenceId.get(fileReferenceId);
            if (!emittedFile)
                return error(errorFileReferenceIdNotFoundForFilename(fileReferenceId));
            if (emittedFile.type === 'chunk') {
                return getChunkFileName(emittedFile, this.facadeChunkByModule);
            }
            return getAssetFileName(emittedFile, fileReferenceId);
        };
        this.setAssetSource = (referenceId, requestedSource) => {
            const consumedFile = this.filesByReferenceId.get(referenceId);
            if (!consumedFile)
                return error(errorAssetReferenceIdNotFoundForSetSource(referenceId));
            if (consumedFile.type !== 'asset') {
                return error(errorFailedValidation(`Asset sources can only be set for emitted assets but "${referenceId}" is an emitted chunk.`));
            }
            if (consumedFile.source !== undefined) {
                return error(errorAssetSourceAlreadySet(consumedFile.name || referenceId));
            }
            const source = getValidSource(requestedSource, consumedFile, referenceId);
            if (this.output) {
                this.finalizeAsset(consumedFile, source, referenceId, this.output);
            }
            else {
                consumedFile.source = source;
            }
        };
        this.setChunkInformation = (facadeChunkByModule) => {
            this.facadeChunkByModule = facadeChunkByModule;
        };
        this.setOutputBundle = (bundle, outputOptions) => {
            const fileNamesBySource = new Map();
            const output = (this.output = { bundle, fileNamesBySource, outputOptions });
            for (const emittedFile of this.filesByReferenceId.values()) {
                if (emittedFile.fileName) {
                    reserveFileNameInBundle(emittedFile.fileName, output, this.options.onwarn);
                }
            }
            for (const [referenceId, consumedFile] of this.filesByReferenceId) {
                if (consumedFile.type === 'asset' && consumedFile.source !== undefined) {
                    this.finalizeAsset(consumedFile, consumedFile.source, referenceId, output);
                }
            }
        };
        this.filesByReferenceId = baseFileEmitter
            ? new Map(baseFileEmitter.filesByReferenceId)
            : new Map();
    }
    assignReferenceId(file, idBase) {
        let referenceId;
        do {
            referenceId = createHash()
                .update(referenceId || idBase)
                .digest('hex')
                .slice(0, 8);
        } while (this.filesByReferenceId.has(referenceId));
        this.filesByReferenceId.set(referenceId, file);
        return referenceId;
    }
    emitAsset(emittedAsset) {
        const source = typeof emittedAsset.source !== 'undefined'
            ? getValidSource(emittedAsset.source, emittedAsset, null)
            : undefined;
        const consumedAsset = {
            fileName: emittedAsset.fileName,
            name: emittedAsset.name,
            source,
            type: 'asset'
        };
        const referenceId = this.assignReferenceId(consumedAsset, emittedAsset.fileName || emittedAsset.name || String(this.nextIdBase++));
        if (this.output) {
            if (emittedAsset.fileName) {
                reserveFileNameInBundle(emittedAsset.fileName, this.output, this.options.onwarn);
            }
            if (source !== undefined) {
                this.finalizeAsset(consumedAsset, source, referenceId, this.output);
            }
        }
        return referenceId;
    }
    emitChunk(emittedChunk) {
        if (this.graph.phase > BuildPhase.LOAD_AND_PARSE) {
            return error(errorInvalidRollupPhaseForChunkEmission());
        }
        if (typeof emittedChunk.id !== 'string') {
            return error(errorFailedValidation(`Emitted chunks need to have a valid string id, received "${emittedChunk.id}"`));
        }
        const consumedChunk = {
            fileName: emittedChunk.fileName,
            module: null,
            name: emittedChunk.name || emittedChunk.id,
            type: 'chunk'
        };
        this.graph.moduleLoader
            .emitChunk(emittedChunk)
            .then(module => (consumedChunk.module = module))
            .catch(() => {
            // Avoid unhandled Promise rejection as the error will be thrown later
            // once module loading has finished
        });
        return this.assignReferenceId(consumedChunk, emittedChunk.id);
    }
    finalizeAsset(consumedFile, source, referenceId, { bundle, fileNamesBySource, outputOptions }) {
        let fileName = consumedFile.fileName;
        // Deduplicate assets if an explicit fileName is not provided
        if (!fileName) {
            const sourceHash = getSourceHash(source);
            fileName = fileNamesBySource.get(sourceHash);
            if (!fileName) {
                fileName = generateAssetFileName(consumedFile.name, source, sourceHash, outputOptions, bundle);
                fileNamesBySource.set(sourceHash, fileName);
            }
        }
        // We must not modify the original assets to avoid interaction between outputs
        const assetWithFileName = { ...consumedFile, fileName, source };
        this.filesByReferenceId.set(referenceId, assetWithFileName);
        bundle[fileName] = {
            fileName,
            name: consumedFile.name,
            source,
            type: 'asset'
        };
    }
}
