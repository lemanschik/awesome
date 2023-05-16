import ExternalModule from '../ExternalModule';
import Module from '../Module';
import { getOrCreate } from './getOrCreate';
import { concatLazy } from './iterators';
import { timeEnd, timeStart } from './timers';
export function getChunkAssignments(entryModules, manualChunkAliasByEntry, minChunkSize) {
    const chunkDefinitions = [];
    const modulesInManualChunks = new Set(manualChunkAliasByEntry.keys());
    const manualChunkModulesByAlias = Object.create(null);
    for (const [entry, alias] of manualChunkAliasByEntry) {
        addStaticDependenciesToManualChunk(entry, (manualChunkModulesByAlias[alias] || (manualChunkModulesByAlias[alias] = [])), modulesInManualChunks);
    }
    for (const [alias, modules] of Object.entries(manualChunkModulesByAlias)) {
        chunkDefinitions.push({ alias, modules });
    }
    const assignedEntryPointsByModule = new Map();
    const { dependentEntryPointsByModule, dynamicEntryModules } = analyzeModuleGraph(entryModules);
    const dynamicallyDependentEntryPointsByDynamicEntry = getDynamicDependentEntryPoints(dependentEntryPointsByModule, dynamicEntryModules);
    const staticEntries = new Set(entryModules);
    function assignEntryToStaticDependencies(entry, dynamicDependentEntryPoints) {
        const modulesToHandle = new Set([entry]);
        for (const module of modulesToHandle) {
            const assignedEntryPoints = getOrCreate(assignedEntryPointsByModule, module, () => new Set());
            if (dynamicDependentEntryPoints &&
                areEntryPointsContainedOrDynamicallyDependent(dynamicDependentEntryPoints, dependentEntryPointsByModule.get(module))) {
                continue;
            }
            else {
                assignedEntryPoints.add(entry);
            }
            for (const dependency of module.getDependenciesToBeIncluded()) {
                if (!(dependency instanceof ExternalModule || modulesInManualChunks.has(dependency))) {
                    modulesToHandle.add(dependency);
                }
            }
        }
    }
    function areEntryPointsContainedOrDynamicallyDependent(entryPoints, containedIn) {
        const entriesToCheck = new Set(entryPoints);
        for (const entry of entriesToCheck) {
            if (!containedIn.has(entry)) {
                if (staticEntries.has(entry))
                    return false;
                const dynamicallyDependentEntryPoints = dynamicallyDependentEntryPointsByDynamicEntry.get(entry);
                for (const dependentEntry of dynamicallyDependentEntryPoints) {
                    entriesToCheck.add(dependentEntry);
                }
            }
        }
        return true;
    }
    for (const entry of entryModules) {
        if (!modulesInManualChunks.has(entry)) {
            assignEntryToStaticDependencies(entry, null);
        }
    }
    for (const entry of dynamicEntryModules) {
        if (!modulesInManualChunks.has(entry)) {
            assignEntryToStaticDependencies(entry, dynamicallyDependentEntryPointsByDynamicEntry.get(entry));
        }
    }
    chunkDefinitions.push(...createChunks([...entryModules, ...dynamicEntryModules], assignedEntryPointsByModule, minChunkSize));
    return chunkDefinitions;
}
function addStaticDependenciesToManualChunk(entry, manualChunkModules, modulesInManualChunks) {
    const modulesToHandle = new Set([entry]);
    for (const module of modulesToHandle) {
        modulesInManualChunks.add(module);
        manualChunkModules.push(module);
        for (const dependency of module.dependencies) {
            if (!(dependency instanceof ExternalModule || modulesInManualChunks.has(dependency))) {
                modulesToHandle.add(dependency);
            }
        }
    }
}
function analyzeModuleGraph(entryModules) {
    const dynamicEntryModules = new Set();
    const dependentEntryPointsByModule = new Map();
    const entriesToHandle = new Set(entryModules);
    for (const currentEntry of entriesToHandle) {
        const modulesToHandle = new Set([currentEntry]);
        for (const module of modulesToHandle) {
            getOrCreate(dependentEntryPointsByModule, module, () => new Set()).add(currentEntry);
            for (const dependency of module.getDependenciesToBeIncluded()) {
                if (!(dependency instanceof ExternalModule)) {
                    modulesToHandle.add(dependency);
                }
            }
            for (const { resolution } of module.dynamicImports) {
                if (resolution instanceof Module && resolution.includedDynamicImporters.length > 0) {
                    dynamicEntryModules.add(resolution);
                    entriesToHandle.add(resolution);
                }
            }
            for (const dependency of module.implicitlyLoadedBefore) {
                dynamicEntryModules.add(dependency);
                entriesToHandle.add(dependency);
            }
        }
    }
    return { dependentEntryPointsByModule, dynamicEntryModules };
}
function getDynamicDependentEntryPoints(dependentEntryPointsByModule, dynamicEntryModules) {
    const dynamicallyDependentEntryPointsByDynamicEntry = new Map();
    for (const dynamicEntry of dynamicEntryModules) {
        const dynamicDependentEntryPoints = getOrCreate(dynamicallyDependentEntryPointsByDynamicEntry, dynamicEntry, () => new Set());
        for (const importer of [
            ...dynamicEntry.includedDynamicImporters,
            ...dynamicEntry.implicitlyLoadedAfter
        ]) {
            for (const entryPoint of dependentEntryPointsByModule.get(importer)) {
                dynamicDependentEntryPoints.add(entryPoint);
            }
        }
    }
    return dynamicallyDependentEntryPointsByDynamicEntry;
}
function createChunks(allEntryPoints, assignedEntryPointsByModule, minChunkSize) {
    const chunkModulesBySignature = getChunkModulesBySignature(assignedEntryPointsByModule, allEntryPoints);
    return minChunkSize === 0
        ? Object.values(chunkModulesBySignature).map(modules => ({
            alias: null,
            modules
        }))
        : getOptimizedChunks(chunkModulesBySignature, minChunkSize);
}
function getOptimizedChunks(chunkModulesBySignature, minChunkSize) {
    timeStart('optimize chunks', 3);
    const { chunksToBeMerged, unmergeableChunks } = getMergeableChunks(chunkModulesBySignature, minChunkSize);
    for (const sourceChunk of chunksToBeMerged) {
        chunksToBeMerged.delete(sourceChunk);
        let closestChunk = null;
        let closestChunkDistance = Infinity;
        const { signature, size, modules } = sourceChunk;
        for (const targetChunk of concatLazy(chunksToBeMerged, unmergeableChunks)) {
            const distance = getSignatureDistance(signature, targetChunk.signature, !chunksToBeMerged.has(targetChunk));
            if (distance === 1) {
                closestChunk = targetChunk;
                break;
            }
            else if (distance < closestChunkDistance) {
                closestChunk = targetChunk;
                closestChunkDistance = distance;
            }
        }
        if (closestChunk) {
            closestChunk.modules.push(...modules);
            if (chunksToBeMerged.has(closestChunk)) {
                closestChunk.signature = mergeSignatures(signature, closestChunk.signature);
                if ((closestChunk.size += size) > minChunkSize) {
                    chunksToBeMerged.delete(closestChunk);
                    unmergeableChunks.push(closestChunk);
                }
            }
        }
        else {
            unmergeableChunks.push(sourceChunk);
        }
    }
    timeEnd('optimize chunks', 3);
    return unmergeableChunks;
}
const CHAR_DEPENDENT = 'X';
const CHAR_INDEPENDENT = '_';
const CHAR_CODE_DEPENDENT = CHAR_DEPENDENT.charCodeAt(0);
function getChunkModulesBySignature(assignedEntryPointsByModule, allEntryPoints) {
    const chunkModules = Object.create(null);
    for (const [module, assignedEntryPoints] of assignedEntryPointsByModule) {
        let chunkSignature = '';
        for (const entry of allEntryPoints) {
            chunkSignature += assignedEntryPoints.has(entry) ? CHAR_DEPENDENT : CHAR_INDEPENDENT;
        }
        const chunk = chunkModules[chunkSignature];
        if (chunk) {
            chunk.push(module);
        }
        else {
            chunkModules[chunkSignature] = [module];
        }
    }
    return chunkModules;
}
function getMergeableChunks(chunkModulesBySignature, minChunkSize) {
    const chunksToBeMerged = new Set();
    const unmergeableChunks = [];
    const alias = null;
    for (const [signature, modules] of Object.entries(chunkModulesBySignature)) {
        let size = 0;
        checkModules: {
            for (const module of modules) {
                if (module.hasEffects()) {
                    break checkModules;
                }
                size += module.magicString.toString().length;
                if (size > minChunkSize) {
                    break checkModules;
                }
            }
            chunksToBeMerged.add({ alias, modules, signature, size });
            continue;
        }
        unmergeableChunks.push({ alias, modules, signature, size: null });
    }
    return { chunksToBeMerged, unmergeableChunks };
}
function getSignatureDistance(sourceSignature, targetSignature, enforceSubset) {
    let distance = 0;
    const { length } = sourceSignature;
    for (let index = 0; index < length; index++) {
        const sourceValue = sourceSignature.charCodeAt(index);
        if (sourceValue !== targetSignature.charCodeAt(index)) {
            if (enforceSubset && sourceValue === CHAR_CODE_DEPENDENT) {
                return Infinity;
            }
            distance++;
        }
    }
    return distance;
}
function mergeSignatures(sourceSignature, targetSignature) {
    let signature = '';
    const { length } = sourceSignature;
    for (let index = 0; index < length; index++) {
        signature +=
            sourceSignature.charCodeAt(index) === CHAR_CODE_DEPENDENT ||
                targetSignature.charCodeAt(index) === CHAR_CODE_DEPENDENT
                ? CHAR_DEPENDENT
                : CHAR_INDEPENDENT;
    }
    return signature;
}
