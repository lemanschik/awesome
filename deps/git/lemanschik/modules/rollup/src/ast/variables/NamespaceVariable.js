import { getToStringTagValue, MERGE_NAMESPACES_VARIABLE } from '../../utils/interopHelpers';
import { getSystemExportStatement } from '../../utils/systemJsRendering';
import { UnknownValue } from '../nodes/shared/Expression';
import { SymbolToStringTag } from '../utils/PathTracker';
import Variable from './Variable';
export default class NamespaceVariable extends Variable {
    constructor(context) {
        super(context.getModuleName());
        this.memberVariables = null;
        this.mergedNamespaces = [];
        this.referencedEarly = false;
        this.references = [];
        this.context = context;
        this.module = context.module;
    }
    addReference(identifier) {
        this.references.push(identifier);
        this.name = identifier.name;
    }
    getLiteralValueAtPath(path) {
        if (path[0] === SymbolToStringTag) {
            return 'Module';
        }
        return UnknownValue;
    }
    getMemberVariables() {
        if (this.memberVariables) {
            return this.memberVariables;
        }
        const memberVariables = Object.create(null);
        for (const name of [...this.context.getExports(), ...this.context.getReexports()]) {
            if (name[0] !== '*' && name !== this.module.info.syntheticNamedExports) {
                const exportedVariable = this.context.traceExport(name);
                if (exportedVariable) {
                    memberVariables[name] = exportedVariable;
                }
            }
        }
        return (this.memberVariables = memberVariables);
    }
    hasEffectsOnInteractionAtPath() {
        return false;
    }
    include() {
        this.included = true;
        this.context.includeAllExports();
    }
    prepare(accessedGlobalsByScope) {
        if (this.mergedNamespaces.length > 0) {
            this.module.scope.addAccessedGlobals([MERGE_NAMESPACES_VARIABLE], accessedGlobalsByScope);
        }
    }
    renderBlock(options) {
        const { exportNamesByVariable, format, freeze, indent: t, namespaceToStringTag, snippets: { _, cnst, getObject, getPropertyAccess, n, s } } = options;
        const memberVariables = this.getMemberVariables();
        const members = Object.entries(memberVariables).map(([name, original]) => {
            if (this.referencedEarly || original.isReassigned) {
                return [
                    null,
                    `get ${name}${_}()${_}{${_}return ${original.getName(getPropertyAccess)}${s}${_}}`
                ];
            }
            return [name, original.getName(getPropertyAccess)];
        });
        members.unshift([null, `__proto__:${_}null`]);
        let output = getObject(members, { lineBreakIndent: { base: '', t } });
        if (this.mergedNamespaces.length > 0) {
            const assignmentArguments = this.mergedNamespaces.map(variable => variable.getName(getPropertyAccess));
            output = `/*#__PURE__*/${MERGE_NAMESPACES_VARIABLE}(${output},${_}[${assignmentArguments.join(`,${_}`)}])`;
        }
        else {
            // The helper to merge namespaces will also take care of freezing and toStringTag
            if (namespaceToStringTag) {
                output = `/*#__PURE__*/Object.defineProperty(${output},${_}Symbol.toStringTag,${_}${getToStringTagValue(getObject)})`;
            }
            if (freeze) {
                output = `/*#__PURE__*/Object.freeze(${output})`;
            }
        }
        const name = this.getName(getPropertyAccess);
        output = `${cnst} ${name}${_}=${_}${output};`;
        if (format === 'system' && exportNamesByVariable.has(this)) {
            output += `${n}${getSystemExportStatement([this], options)};`;
        }
        return output;
    }
    renderFirst() {
        return this.referencedEarly;
    }
    setMergedNamespaces(mergedNamespaces) {
        this.mergedNamespaces = mergedNamespaces;
        const moduleExecIndex = this.context.getModuleExecIndex();
        for (const identifier of this.references) {
            if (identifier.context.getModuleExecIndex() <= moduleExecIndex) {
                this.referencedEarly = true;
                break;
            }
        }
    }
}
NamespaceVariable.prototype.isNamespace = true;
