import ExternalModule from '../ExternalModule';
export function getStaticDependencies(chunk, orderedModules, chunkByModule, externalChunkByModule) {
    const staticDependencyBlocks = [];
    const handledDependencies = new Set();
    for (let modulePos = orderedModules.length - 1; modulePos >= 0; modulePos--) {
        const module = orderedModules[modulePos];
        if (!handledDependencies.has(module)) {
            const staticDependencies = [];
            addStaticDependencies(module, staticDependencies, handledDependencies, chunk, chunkByModule, externalChunkByModule);
            staticDependencyBlocks.unshift(staticDependencies);
        }
    }
    const dependencies = new Set();
    for (const block of staticDependencyBlocks) {
        for (const dependency of block) {
            dependencies.add(dependency);
        }
    }
    return dependencies;
}
function addStaticDependencies(module, staticDependencies, handledModules, chunk, chunkByModule, externalChunkByModule) {
    const dependencies = module.getDependenciesToBeIncluded();
    for (const dependency of dependencies) {
        if (dependency instanceof ExternalModule) {
            staticDependencies.push(externalChunkByModule.get(dependency));
            continue;
        }
        const dependencyChunk = chunkByModule.get(dependency);
        if (dependencyChunk !== chunk) {
            staticDependencies.push(dependencyChunk);
            continue;
        }
        if (!handledModules.has(dependency)) {
            handledModules.add(dependency);
            addStaticDependencies(dependency, staticDependencies, handledModules, chunk, chunkByModule, externalChunkByModule);
        }
    }
}
