import { defaultInteropHelpersByInteropType, getHelpersBlock, INTEROP_NAMESPACE_DEFAULT_ONLY_VARIABLE, namespaceInteropHelpersByInteropType } from '../../utils/interopHelpers';
export default function getInteropBlock(dependencies, interop, externalLiveBindings, freeze, namespaceToStringTag, accessedGlobals, indent, snippets) {
    const { _, cnst, n } = snippets;
    const neededInteropHelpers = new Set();
    const interopStatements = [];
    const addInteropStatement = (helperVariableName, helper, dependencyVariableName) => {
        neededInteropHelpers.add(helper);
        interopStatements.push(`${cnst} ${helperVariableName}${_}=${_}/*#__PURE__*/${helper}(${dependencyVariableName});`);
    };
    for (const { defaultVariableName, imports, importPath, isChunk, name, namedExportsMode, namespaceVariableName, reexports } of dependencies) {
        if (isChunk) {
            for (const { imported, reexported } of [
                ...(imports || []),
                ...(reexports || [])
            ]) {
                if (imported === '*' && reexported !== '*') {
                    if (!namedExportsMode) {
                        addInteropStatement(namespaceVariableName, INTEROP_NAMESPACE_DEFAULT_ONLY_VARIABLE, name);
                    }
                    break;
                }
            }
        }
        else {
            const moduleInterop = interop(importPath);
            let hasDefault = false;
            let hasNamespace = false;
            for (const { imported, reexported } of [
                ...(imports || []),
                ...(reexports || [])
            ]) {
                let helper;
                let variableName;
                if (imported === 'default') {
                    if (!hasDefault) {
                        hasDefault = true;
                        if (defaultVariableName !== namespaceVariableName) {
                            variableName = defaultVariableName;
                            helper = defaultInteropHelpersByInteropType[moduleInterop];
                        }
                    }
                }
                else if (imported === '*' && reexported !== '*' && !hasNamespace) {
                    hasNamespace = true;
                    helper = namespaceInteropHelpersByInteropType[moduleInterop];
                    variableName = namespaceVariableName;
                }
                if (helper) {
                    addInteropStatement(variableName, helper, name);
                }
            }
        }
    }
    return `${getHelpersBlock(neededInteropHelpers, accessedGlobals, indent, snippets, externalLiveBindings, freeze, namespaceToStringTag)}${interopStatements.length > 0 ? `${interopStatements.join(n)}${n}${n}` : ''}`;
}
