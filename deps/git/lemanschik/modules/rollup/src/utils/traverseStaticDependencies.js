import ExternalModule from '../ExternalModule';
export function markModuleAndImpureDependenciesAsExecuted(baseModule) {
    baseModule.isExecuted = true;
    const modules = [baseModule];
    const visitedModules = new Set();
    for (const module of modules) {
        for (const dependency of [...module.dependencies, ...module.implicitlyLoadedBefore]) {
            if (!(dependency instanceof ExternalModule) &&
                !dependency.isExecuted &&
                (dependency.info.moduleSideEffects || module.implicitlyLoadedBefore.has(dependency)) &&
                !visitedModules.has(dependency.id)) {
                dependency.isExecuted = true;
                visitedModules.add(dependency.id);
                modules.push(dependency);
            }
        }
    }
}
