import getCompleteAmdId from './shared/getCompleteAmdId';
import { getExportBlock, getNamespaceMarkers } from './shared/getExportBlock';
import getInteropBlock from './shared/getInteropBlock';
import updateExtensionForRelativeAmdId from './shared/updateExtensionForRelativeAmdId';
import warnOnBuiltins from './shared/warnOnBuiltins';
export default function amd(magicString, { accessedGlobals, dependencies, exports, hasDefaultExport, hasExports, id, indent: t, intro, isEntryFacade, isModuleFacade, namedExportsMode, outro, snippets, onwarn }, { amd, esModule, externalLiveBindings, freeze, interop, namespaceToStringTag, strict }) {
    warnOnBuiltins(onwarn, dependencies);
    const deps = dependencies.map(m => `'${updateExtensionForRelativeAmdId(m.importPath, amd.forceJsExtensionForImports)}'`);
    const parameters = dependencies.map(m => m.name);
    const { n, getNonArrowFunctionIntro, _ } = snippets;
    if (namedExportsMode && hasExports) {
        parameters.unshift(`exports`);
        deps.unshift(`'exports'`);
    }
    if (accessedGlobals.has('require')) {
        parameters.unshift('require');
        deps.unshift(`'require'`);
    }
    if (accessedGlobals.has('module')) {
        parameters.unshift('module');
        deps.unshift(`'module'`);
    }
    const completeAmdId = getCompleteAmdId(amd, id);
    const defineParameters = (completeAmdId ? `'${completeAmdId}',${_}` : ``) +
        (deps.length > 0 ? `[${deps.join(`,${_}`)}],${_}` : ``);
    const useStrict = strict ? `${_}'use strict';` : '';
    magicString.prepend(`${intro}${getInteropBlock(dependencies, interop, externalLiveBindings, freeze, namespaceToStringTag, accessedGlobals, t, snippets)}`);
    const exportBlock = getExportBlock(exports, dependencies, namedExportsMode, interop, snippets, t, externalLiveBindings);
    let namespaceMarkers = getNamespaceMarkers(namedExportsMode && hasExports, isEntryFacade && (esModule === true || (esModule === 'if-default-prop' && hasDefaultExport)), isModuleFacade && namespaceToStringTag, snippets);
    if (namespaceMarkers) {
        namespaceMarkers = n + n + namespaceMarkers;
    }
    magicString
        .append(`${exportBlock}${namespaceMarkers}${outro}`)
        .indent(t)
        // factory function should be wrapped by parentheses to avoid lazy parsing,
        // cf. https://v8.dev/blog/preparser#pife
        .prepend(`${amd.define}(${defineParameters}(${getNonArrowFunctionIntro(parameters, {
        isAsync: false,
        name: null
    })}{${useStrict}${n}${n}`)
        .append(`${n}${n}}));`);
}
