import Module from '../Module';
const compareExecIndex = (unitA, unitB) => unitA.execIndex > unitB.execIndex ? 1 : -1;
export function sortByExecutionOrder(units) {
    units.sort(compareExecIndex);
}
export function analyseModuleExecution(entryModules) {
    let nextExecIndex = 0;
    const cyclePaths = [];
    const analysedModules = new Set();
    const dynamicImports = new Set();
    const parents = new Map();
    const orderedModules = [];
    const analyseModule = (module) => {
        if (module instanceof Module) {
            for (const dependency of module.dependencies) {
                if (parents.has(dependency)) {
                    if (!analysedModules.has(dependency)) {
                        cyclePaths.push(getCyclePath(dependency, module, parents));
                    }
                    continue;
                }
                parents.set(dependency, module);
                analyseModule(dependency);
            }
            for (const dependency of module.implicitlyLoadedBefore) {
                dynamicImports.add(dependency);
            }
            for (const { resolution } of module.dynamicImports) {
                if (resolution instanceof Module) {
                    dynamicImports.add(resolution);
                }
            }
            orderedModules.push(module);
        }
        module.execIndex = nextExecIndex++;
        analysedModules.add(module);
    };
    for (const currentEntry of entryModules) {
        if (!parents.has(currentEntry)) {
            parents.set(currentEntry, null);
            analyseModule(currentEntry);
        }
    }
    for (const currentEntry of dynamicImports) {
        if (!parents.has(currentEntry)) {
            parents.set(currentEntry, null);
            analyseModule(currentEntry);
        }
    }
    return { cyclePaths, orderedModules };
}
function getCyclePath(module, parent, parents) {
    const cycleSymbol = Symbol(module.id);
    const path = [module.id];
    let nextModule = parent;
    module.cycles.add(cycleSymbol);
    while (nextModule !== module) {
        nextModule.cycles.add(cycleSymbol);
        path.push(nextModule.id);
        nextModule = parents.get(nextModule);
    }
    path.push(path[0]);
    path.reverse();
    return path;
}
