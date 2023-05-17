import { getHelpersBlock } from '../utils/interopHelpers';
import { MISSING_EXPORT_SHIM_VARIABLE } from '../utils/variableNames';
export default function system(magicString, { accessedGlobals, dependencies, exports, hasExports, indent: t, intro, snippets, outro, usesTopLevelAwait }, { externalLiveBindings, freeze, name, namespaceToStringTag, strict, systemNullSetters }) {
    const { _, getFunctionIntro, getNonArrowFunctionIntro, n, s } = snippets;
    const { importBindings, setters, starExcludes } = analyzeDependencies(dependencies, exports, t, snippets);
    const registeredName = name ? `'${name}',${_}` : '';
    const wrapperParameters = accessedGlobals.has('module')
        ? ['exports', 'module']
        : hasExports
            ? ['exports']
            : [];
    // factory function should be wrapped by parentheses to avoid lazy parsing,
    // cf. https://v8.dev/blog/preparser#pife
    let wrapperStart = `System.register(${registeredName}[` +
        dependencies.map(({ importPath }) => `'${importPath}'`).join(`,${_}`) +
        `],${_}(${getNonArrowFunctionIntro(wrapperParameters, {
            isAsync: false,
            name: null
        })}{${n}${t}${strict ? "'use strict';" : ''}` +
        getStarExcludesBlock(starExcludes, t, snippets) +
        getImportBindingsBlock(importBindings, t, snippets) +
        `${n}${t}return${_}{${setters.length > 0
            ? `${n}${t}${t}setters:${_}[${setters
                .map(setter => setter
                ? `${getFunctionIntro(['module'], {
                    isAsync: false,
                    name: null
                })}{${n}${t}${t}${t}${setter}${n}${t}${t}}`
                : systemNullSetters
                    ? `null`
                    : `${getFunctionIntro([], { isAsync: false, name: null })}{}`)
                .join(`,${_}`)}],`
            : ''}${n}`;
    wrapperStart += `${t}${t}execute:${_}(${getNonArrowFunctionIntro([], {
        isAsync: usesTopLevelAwait,
        name: null
    })}{${n}${n}`;
    const wrapperEnd = `${t}${t}})${n}${t}}${s}${n}}));`;
    magicString
        .prepend(intro +
        getHelpersBlock(null, accessedGlobals, t, snippets, externalLiveBindings, freeze, namespaceToStringTag) +
        getHoistedExportsBlock(exports, t, snippets))
        .append(`${outro}${n}${n}` +
        getSyntheticExportsBlock(exports, t, snippets) +
        getMissingExportsBlock(exports, t, snippets))
        .indent(`${t}${t}${t}`)
        .append(wrapperEnd)
        .prepend(wrapperStart);
}
function analyzeDependencies(dependencies, exports, t, { _, cnst, getObject, getPropertyAccess, n }) {
    const importBindings = [];
    const setters = [];
    let starExcludes = null;
    for (const { imports, reexports } of dependencies) {
        const setter = [];
        if (imports) {
            for (const specifier of imports) {
                importBindings.push(specifier.local);
                if (specifier.imported === '*') {
                    setter.push(`${specifier.local}${_}=${_}module;`);
                }
                else {
                    setter.push(`${specifier.local}${_}=${_}module${getPropertyAccess(specifier.imported)};`);
                }
            }
        }
        if (reexports) {
            const reexportedNames = [];
            let hasStarReexport = false;
            for (const { imported, reexported } of reexports) {
                if (reexported === '*') {
                    hasStarReexport = true;
                }
                else {
                    reexportedNames.push([
                        reexported,
                        imported === '*' ? 'module' : `module${getPropertyAccess(imported)}`
                    ]);
                }
            }
            if (reexportedNames.length > 1 || hasStarReexport) {
                const exportMapping = getObject(reexportedNames, { lineBreakIndent: null });
                if (hasStarReexport) {
                    if (!starExcludes) {
                        starExcludes = getStarExcludes({ dependencies, exports });
                    }
                    setter.push(`${cnst} setter${_}=${_}${exportMapping};`, `for${_}(${cnst} name in module)${_}{`, `${t}if${_}(!_starExcludes[name])${_}setter[name]${_}=${_}module[name];`, '}', 'exports(setter);');
                }
                else {
                    setter.push(`exports(${exportMapping});`);
                }
            }
            else {
                const [key, value] = reexportedNames[0];
                setter.push(`exports('${key}',${_}${value});`);
            }
        }
        setters.push(setter.join(`${n}${t}${t}${t}`));
    }
    return { importBindings, setters, starExcludes };
}
const getStarExcludes = ({ dependencies, exports }) => {
    const starExcludes = new Set(exports.map(expt => expt.exported));
    starExcludes.add('default');
    for (const { reexports } of dependencies) {
        if (reexports) {
            for (const reexport of reexports) {
                if (reexport.reexported !== '*')
                    starExcludes.add(reexport.reexported);
            }
        }
    }
    return starExcludes;
};
const getStarExcludesBlock = (starExcludes, t, { _, cnst, getObject, n }) => starExcludes
    ? `${n}${t}${cnst} _starExcludes${_}=${_}${getObject([...starExcludes].map(property => [property, '1']), { lineBreakIndent: { base: t, t } })};`
    : '';
const getImportBindingsBlock = (importBindings, t, { _, n }) => (importBindings.length > 0 ? `${n}${t}var ${importBindings.join(`,${_}`)};` : '');
const getHoistedExportsBlock = (exports, t, snippets) => getExportsBlock(exports.filter(expt => expt.hoisted).map(expt => ({ name: expt.exported, value: expt.local })), t, snippets);
function getExportsBlock(exports, t, { _, n }) {
    if (exports.length === 0) {
        return '';
    }
    if (exports.length === 1) {
        return `exports('${exports[0].name}',${_}${exports[0].value});${n}${n}`;
    }
    return (`exports({${n}` +
        exports.map(({ name, value }) => `${t}${name}:${_}${value}`).join(`,${n}`) +
        `${n}});${n}${n}`);
}
const getSyntheticExportsBlock = (exports, t, snippets) => getExportsBlock(exports
    .filter(expt => expt.expression)
    .map(expt => ({ name: expt.exported, value: expt.local })), t, snippets);
const getMissingExportsBlock = (exports, t, snippets) => getExportsBlock(exports
    .filter(expt => expt.local === MISSING_EXPORT_SHIM_VARIABLE)
    .map(expt => ({ name: expt.exported, value: MISSING_EXPORT_SHIM_VARIABLE })), t, snippets);
