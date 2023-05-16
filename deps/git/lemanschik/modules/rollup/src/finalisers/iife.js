import { error, errorIllegalIdentifierAsName, errorMissingNameOptionForIifeExport } from '../utils/error';
import { isLegal } from '../utils/identifierHelpers';
import { getExportBlock, getNamespaceMarkers } from './shared/getExportBlock';
import getInteropBlock from './shared/getInteropBlock';
import { keypath } from './shared/sanitize';
import setupNamespace from './shared/setupNamespace';
import trimEmptyImports from './shared/trimEmptyImports';
import warnOnBuiltins from './shared/warnOnBuiltins';
export default function iife(magicString, { accessedGlobals, dependencies, exports, hasDefaultExport, hasExports, indent: t, intro, namedExportsMode, outro, snippets, onwarn }, { compact, esModule, extend, freeze, externalLiveBindings, globals, interop, name, namespaceToStringTag, strict }) {
    const { _, getNonArrowFunctionIntro, getPropertyAccess, n } = snippets;
    const isNamespaced = name && name.includes('.');
    const useVariableAssignment = !extend && !isNamespaced;
    if (name && useVariableAssignment && !isLegal(name)) {
        return error(errorIllegalIdentifierAsName(name));
    }
    warnOnBuiltins(onwarn, dependencies);
    const external = trimEmptyImports(dependencies);
    const deps = external.map(dep => dep.globalName || 'null');
    const parameters = external.map(m => m.name);
    if (hasExports && !name) {
        onwarn(errorMissingNameOptionForIifeExport());
    }
    if (namedExportsMode && hasExports) {
        if (extend) {
            deps.unshift(`this${keypath(name, getPropertyAccess)}${_}=${_}this${keypath(name, getPropertyAccess)}${_}||${_}{}`);
            parameters.unshift('exports');
        }
        else {
            deps.unshift('{}');
            parameters.unshift('exports');
        }
    }
    const useStrict = strict ? `${t}'use strict';${n}` : '';
    const interopBlock = getInteropBlock(dependencies, interop, externalLiveBindings, freeze, namespaceToStringTag, accessedGlobals, t, snippets);
    magicString.prepend(`${intro}${interopBlock}`);
    let wrapperIntro = `(${getNonArrowFunctionIntro(parameters, {
        isAsync: false,
        name: null
    })}{${n}${useStrict}${n}`;
    if (hasExports) {
        if (name && !(extend && namedExportsMode)) {
            wrapperIntro =
                (useVariableAssignment ? `var ${name}` : `this${keypath(name, getPropertyAccess)}`) +
                    `${_}=${_}${wrapperIntro}`;
        }
        if (isNamespaced) {
            wrapperIntro = setupNamespace(name, 'this', globals, snippets, compact) + wrapperIntro;
        }
    }
    let wrapperOutro = `${n}${n}})(${deps.join(`,${_}`)});`;
    if (hasExports && !extend && namedExportsMode) {
        wrapperOutro = `${n}${n}${t}return exports;${wrapperOutro}`;
    }
    const exportBlock = getExportBlock(exports, dependencies, namedExportsMode, interop, snippets, t, externalLiveBindings);
    let namespaceMarkers = getNamespaceMarkers(namedExportsMode && hasExports, esModule === true || (esModule === 'if-default-prop' && hasDefaultExport), namespaceToStringTag, snippets);
    if (namespaceMarkers) {
        namespaceMarkers = n + n + namespaceMarkers;
    }
    magicString
        .append(`${exportBlock}${namespaceMarkers}${outro}`)
        .indent(t)
        .prepend(wrapperIntro)
        .append(wrapperOutro);
}
