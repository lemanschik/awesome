import { collapseSourcemaps } from './collapseSourcemaps';
import { createHash } from './crypto';
import { decodedSourcemap } from './decodedSourcemap';
import { error, errorFailedValidation } from './error';
import { replacePlaceholders, replacePlaceholdersWithDefaultAndGetContainedPlaceholders, replaceSinglePlaceholder } from './hashPlaceholders';
import { FILE_PLACEHOLDER, lowercaseBundleKeys } from './outputBundle';
import { basename, normalize, resolve } from './path';
import { SOURCEMAPPING_URL } from './sourceMappingURL';
import { timeEnd, timeStart } from './timers';
export async function renderChunks(chunks, bundle, pluginDriver, outputOptions, onwarn) {
    timeStart('render chunks', 2);
    reserveEntryChunksInBundle(chunks);
    const renderedChunks = await Promise.all(chunks.map(chunk => chunk.render()));
    timeEnd('render chunks', 2);
    timeStart('transform chunks', 2);
    const chunkGraph = getChunkGraph(chunks);
    const { nonHashedChunksWithPlaceholders, renderedChunksByPlaceholder, hashDependenciesByPlaceholder } = await transformChunksAndGenerateContentHashes(renderedChunks, chunkGraph, outputOptions, pluginDriver, onwarn);
    const hashesByPlaceholder = generateFinalHashes(renderedChunksByPlaceholder, hashDependenciesByPlaceholder, bundle);
    addChunksToBundle(renderedChunksByPlaceholder, hashesByPlaceholder, bundle, nonHashedChunksWithPlaceholders, pluginDriver, outputOptions);
    timeEnd('transform chunks', 2);
}
function reserveEntryChunksInBundle(chunks) {
    for (const chunk of chunks) {
        if (chunk.facadeModule && chunk.facadeModule.isUserDefinedEntryPoint) {
            // reserves name in bundle as side effect if it does not contain a hash
            chunk.getPreliminaryFileName();
        }
    }
}
function getChunkGraph(chunks) {
    return Object.fromEntries(chunks.map(chunk => {
        const renderedChunkInfo = chunk.getRenderedChunkInfo();
        return [renderedChunkInfo.fileName, renderedChunkInfo];
    }));
}
async function transformChunk(magicString, fileName, usedModules, chunkGraph, options, outputPluginDriver, onwarn) {
    let map = null;
    const sourcemapChain = [];
    let code = await outputPluginDriver.hookReduceArg0('renderChunk', [magicString.toString(), chunkGraph[fileName], options, { chunks: chunkGraph }], (code, result, plugin) => {
        if (result == null)
            return code;
        if (typeof result === 'string')
            result = {
                code: result,
                map: undefined
            };
        // strict null check allows 'null' maps to not be pushed to the chain, while 'undefined' gets the missing map warning
        if (result.map !== null) {
            const map = decodedSourcemap(result.map);
            sourcemapChain.push(map || { missing: true, plugin: plugin.name });
        }
        return result.code;
    });
    const { compact, dir, file, sourcemap, sourcemapExcludeSources, sourcemapFile, sourcemapPathTransform } = options;
    if (!compact && code[code.length - 1] !== '\n')
        code += '\n';
    if (sourcemap) {
        timeStart('sourcemaps', 3);
        let resultingFile;
        if (file)
            resultingFile = resolve(sourcemapFile || file);
        else if (dir)
            resultingFile = resolve(dir, fileName);
        else
            resultingFile = resolve(fileName);
        const decodedMap = magicString.generateDecodedMap({});
        map = collapseSourcemaps(resultingFile, decodedMap, usedModules, sourcemapChain, sourcemapExcludeSources, onwarn);
        map.sources = map.sources
            .map(sourcePath => {
            if (sourcemapPathTransform) {
                const newSourcePath = sourcemapPathTransform(sourcePath, `${resultingFile}.map`);
                if (typeof newSourcePath !== 'string') {
                    error(errorFailedValidation(`sourcemapPathTransform function must return a string.`));
                }
                return newSourcePath;
            }
            return sourcePath;
        })
            .map(normalize);
        timeEnd('sourcemaps', 3);
    }
    return {
        code,
        map
    };
}
async function transformChunksAndGenerateContentHashes(renderedChunks, chunkGraph, outputOptions, pluginDriver, onwarn) {
    const nonHashedChunksWithPlaceholders = [];
    const renderedChunksByPlaceholder = new Map();
    const hashDependenciesByPlaceholder = new Map();
    const placeholders = new Set();
    for (const { preliminaryFileName: { hashPlaceholder } } of renderedChunks) {
        if (hashPlaceholder)
            placeholders.add(hashPlaceholder);
    }
    await Promise.all(renderedChunks.map(async ({ chunk, preliminaryFileName: { fileName, hashPlaceholder }, magicString, usedModules }) => {
        const transformedChunk = {
            chunk,
            fileName,
            ...(await transformChunk(magicString, fileName, usedModules, chunkGraph, outputOptions, pluginDriver, onwarn))
        };
        const { code } = transformedChunk;
        if (hashPlaceholder) {
            const hash = createHash();
            // To create a reproducible content-only hash, all placeholders are
            // replaced with the same value before hashing
            const { containedPlaceholders, transformedCode } = replacePlaceholdersWithDefaultAndGetContainedPlaceholders(code, placeholders);
            hash.update(transformedCode);
            const hashAugmentation = pluginDriver.hookReduceValueSync('augmentChunkHash', '', [chunk.getRenderedChunkInfo()], (augmentation, pluginHash) => {
                if (pluginHash) {
                    augmentation += pluginHash;
                }
                return augmentation;
            });
            if (hashAugmentation) {
                hash.update(hashAugmentation);
            }
            renderedChunksByPlaceholder.set(hashPlaceholder, transformedChunk);
            hashDependenciesByPlaceholder.set(hashPlaceholder, {
                containedPlaceholders,
                contentHash: hash.digest('hex')
            });
        }
        else {
            nonHashedChunksWithPlaceholders.push(transformedChunk);
        }
    }));
    return {
        hashDependenciesByPlaceholder,
        nonHashedChunksWithPlaceholders,
        renderedChunksByPlaceholder
    };
}
function generateFinalHashes(renderedChunksByPlaceholder, hashDependenciesByPlaceholder, bundle) {
    const hashesByPlaceholder = new Map();
    for (const [placeholder, { fileName }] of renderedChunksByPlaceholder) {
        let hash = createHash();
        const hashDependencyPlaceholders = new Set([placeholder]);
        for (const dependencyPlaceholder of hashDependencyPlaceholders) {
            const { containedPlaceholders, contentHash } = hashDependenciesByPlaceholder.get(dependencyPlaceholder);
            hash.update(contentHash);
            for (const containedPlaceholder of containedPlaceholders) {
                // When looping over a map, setting an entry only causes a new iteration if the key is new
                hashDependencyPlaceholders.add(containedPlaceholder);
            }
        }
        let finalFileName;
        let finalHash;
        do {
            // In case of a hash collision, create a hash of the hash
            if (finalHash) {
                hash = createHash();
                hash.update(finalHash);
            }
            finalHash = hash.digest('hex').slice(0, placeholder.length);
            finalFileName = replaceSinglePlaceholder(fileName, placeholder, finalHash);
        } while (bundle[lowercaseBundleKeys].has(finalFileName.toLowerCase()));
        bundle[finalFileName] = FILE_PLACEHOLDER;
        hashesByPlaceholder.set(placeholder, finalHash);
    }
    return hashesByPlaceholder;
}
function addChunksToBundle(renderedChunksByPlaceholder, hashesByPlaceholder, bundle, nonHashedChunksWithPlaceholders, pluginDriver, options) {
    for (const { chunk, code, fileName, map } of renderedChunksByPlaceholder.values()) {
        let updatedCode = replacePlaceholders(code, hashesByPlaceholder);
        const finalFileName = replacePlaceholders(fileName, hashesByPlaceholder);
        if (map) {
            map.file = replacePlaceholders(map.file, hashesByPlaceholder);
            updatedCode += emitSourceMapAndGetComment(finalFileName, map, pluginDriver, options);
        }
        bundle[finalFileName] = chunk.generateOutputChunk(updatedCode, map, hashesByPlaceholder);
    }
    for (const { chunk, code, fileName, map } of nonHashedChunksWithPlaceholders) {
        let updatedCode = hashesByPlaceholder.size > 0 ? replacePlaceholders(code, hashesByPlaceholder) : code;
        if (map) {
            updatedCode += emitSourceMapAndGetComment(fileName, map, pluginDriver, options);
        }
        bundle[fileName] = chunk.generateOutputChunk(updatedCode, map, hashesByPlaceholder);
    }
}
function emitSourceMapAndGetComment(fileName, map, pluginDriver, { sourcemap, sourcemapBaseUrl }) {
    let url;
    if (sourcemap === 'inline') {
        url = map.toUrl();
    }
    else {
        const sourcemapFileName = `${basename(fileName)}.map`;
        url = sourcemapBaseUrl
            ? new URL(sourcemapFileName, sourcemapBaseUrl).toString()
            : sourcemapFileName;
        pluginDriver.emitFile({ fileName: `${fileName}.map`, source: map.toString(), type: 'asset' });
    }
    return sourcemap === 'hidden' ? '' : `//# ${SOURCEMAPPING_URL}=${url}\n`;
}
