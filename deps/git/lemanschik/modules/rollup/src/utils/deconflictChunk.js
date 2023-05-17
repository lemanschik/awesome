import ExternalChunk from '../ExternalChunk';
import ExternalModule from '../ExternalModule';
import ExportDefaultVariable from '../ast/variables/ExportDefaultVariable';
import { canDefaultBeTakenFromNamespace, defaultInteropHelpersByInteropType, isDefaultAProperty, namespaceInteropHelpersByInteropType } from './interopHelpers';
import { getSafeName } from './safeName';
const DECONFLICT_IMPORTED_VARIABLES_BY_FORMAT = {
    amd: deconflictImportsOther,
    cjs: deconflictImportsOther,
    es: deconflictImportsEsmOrSystem,
    iife: deconflictImportsOther,
    system: deconflictImportsEsmOrSystem,
    umd: deconflictImportsOther
};
export function deconflictChunk(modules, dependenciesToBeDeconflicted, imports, usedNames, format, interop, preserveModules, externalLiveBindings, chunkByModule, externalChunkByModule, syntheticExports, exportNamesByVariable, accessedGlobalsByScope, includedNamespaces) {
    const reversedModules = [...modules].reverse();
    for (const module of reversedModules) {
        module.scope.addUsedOutsideNames(usedNames, format, exportNamesByVariable, accessedGlobalsByScope);
    }
    deconflictTopLevelVariables(usedNames, reversedModules, includedNamespaces);
    DECONFLICT_IMPORTED_VARIABLES_BY_FORMAT[format](usedNames, imports, dependenciesToBeDeconflicted, interop, preserveModules, externalLiveBindings, chunkByModule, externalChunkByModule, syntheticExports);
    for (const module of reversedModules) {
        module.scope.deconflict(format, exportNamesByVariable, accessedGlobalsByScope);
    }
}
function deconflictImportsEsmOrSystem(usedNames, imports, dependenciesToBeDeconflicted, _interop, preserveModules, _externalLiveBindings, chunkByModule, externalChunkByModule, syntheticExports) {
    // This is needed for namespace reexports
    for (const dependency of dependenciesToBeDeconflicted.dependencies) {
        if (preserveModules || dependency instanceof ExternalChunk) {
            dependency.variableName = getSafeName(dependency.suggestedVariableName, usedNames, null);
        }
    }
    for (const variable of imports) {
        const module = variable.module;
        const name = variable.name;
        if (variable.isNamespace && (preserveModules || module instanceof ExternalModule)) {
            variable.setRenderNames(null, (module instanceof ExternalModule
                ? externalChunkByModule.get(module)
                : chunkByModule.get(module)).variableName);
        }
        else if (module instanceof ExternalModule && name === 'default') {
            variable.setRenderNames(null, getSafeName([...module.exportedVariables].some(([exportedVariable, exportedName]) => exportedName === '*' && exportedVariable.included)
                ? module.suggestedVariableName + '__default'
                : module.suggestedVariableName, usedNames, variable.forbiddenNames));
        }
        else {
            variable.setRenderNames(null, getSafeName(name, usedNames, variable.forbiddenNames));
        }
    }
    for (const variable of syntheticExports) {
        variable.setRenderNames(null, getSafeName(variable.name, usedNames, variable.forbiddenNames));
    }
}
function deconflictImportsOther(usedNames, imports, { deconflictedDefault, deconflictedNamespace, dependencies }, interop, preserveModules, externalLiveBindings, chunkByModule, externalChunkByModule) {
    for (const chunk of dependencies) {
        chunk.variableName = getSafeName(chunk.suggestedVariableName, usedNames, null);
    }
    for (const chunk of deconflictedNamespace) {
        chunk.namespaceVariableName = getSafeName(`${chunk.suggestedVariableName}__namespace`, usedNames, null);
    }
    for (const externalModule of deconflictedDefault) {
        externalModule.defaultVariableName =
            deconflictedNamespace.has(externalModule) &&
                canDefaultBeTakenFromNamespace(interop(externalModule.id), externalLiveBindings)
                ? externalModule.namespaceVariableName
                : getSafeName(`${externalModule.suggestedVariableName}__default`, usedNames, null);
    }
    for (const variable of imports) {
        const module = variable.module;
        if (module instanceof ExternalModule) {
            const chunk = externalChunkByModule.get(module);
            const name = variable.name;
            if (name === 'default') {
                const moduleInterop = interop(module.id);
                const variableName = defaultInteropHelpersByInteropType[moduleInterop]
                    ? chunk.defaultVariableName
                    : chunk.variableName;
                if (isDefaultAProperty(moduleInterop, externalLiveBindings)) {
                    variable.setRenderNames(variableName, 'default');
                }
                else {
                    variable.setRenderNames(null, variableName);
                }
            }
            else if (name === '*') {
                variable.setRenderNames(null, namespaceInteropHelpersByInteropType[interop(module.id)]
                    ? chunk.namespaceVariableName
                    : chunk.variableName);
            }
            else {
                // if the second parameter is `null`, it uses its "name" for the property name
                variable.setRenderNames(chunk.variableName, null);
            }
        }
        else {
            const chunk = chunkByModule.get(module);
            if (preserveModules && variable.isNamespace) {
                variable.setRenderNames(null, chunk.exportMode === 'default' ? chunk.namespaceVariableName : chunk.variableName);
            }
            else if (chunk.exportMode === 'default') {
                variable.setRenderNames(null, chunk.variableName);
            }
            else {
                variable.setRenderNames(chunk.variableName, chunk.getVariableExportName(variable));
            }
        }
    }
}
function deconflictTopLevelVariables(usedNames, modules, includedNamespaces) {
    for (const module of modules) {
        for (const variable of module.scope.variables.values()) {
            if (variable.included &&
                // this will only happen for exports in some formats
                !(variable.renderBaseName ||
                    (variable instanceof ExportDefaultVariable && variable.getOriginalVariable() !== variable))) {
                variable.setRenderNames(null, getSafeName(variable.name, usedNames, variable.forbiddenNames));
            }
        }
        if (includedNamespaces.has(module)) {
            const namespace = module.namespace;
            namespace.setRenderNames(null, getSafeName(namespace.name, usedNames, namespace.forbiddenNames));
        }
    }
}
