import ExternalModule from '../../ExternalModule';
import { INTEROP_NAMESPACE_DEFAULT_ONLY_VARIABLE, namespaceInteropHelpersByInteropType } from '../../utils/interopHelpers';
import { findFirstOccurrenceOutsideComment } from '../../utils/renderHelpers';
import { NodeBase } from './shared/Node';
// TODO once ImportExpression follows official ESTree specs with "null" as
//  default, keys.ts should be updated
export default class ImportExpression extends NodeBase {
    constructor() {
        super(...arguments);
        this.inlineNamespace = null;
        this.assertions = null;
        this.mechanism = null;
        this.namespaceExportName = undefined;
        this.resolution = null;
        this.resolutionString = null;
    }
    // Do not bind assertions
    bind() {
        this.source.bind();
    }
    hasEffects() {
        return true;
    }
    include(context, includeChildrenRecursively) {
        if (!this.included) {
            this.included = true;
            this.context.includeDynamicImport(this);
            this.scope.addAccessedDynamicImport(this);
        }
        this.source.include(context, includeChildrenRecursively);
    }
    initialise() {
        this.context.addDynamicImport(this);
    }
    render(code, options) {
        const { snippets: { _, getDirectReturnFunction, getObject, getPropertyAccess } } = options;
        if (this.inlineNamespace) {
            const [left, right] = getDirectReturnFunction([], {
                functionReturn: true,
                lineBreakIndent: null,
                name: null
            });
            code.overwrite(this.start, this.end, `Promise.resolve().then(${left}${this.inlineNamespace.getName(getPropertyAccess)}${right})`);
            return;
        }
        if (this.mechanism) {
            code.overwrite(this.start, findFirstOccurrenceOutsideComment(code.original, '(', this.start + 6) + 1, this.mechanism.left);
            code.overwrite(this.end - 1, this.end, this.mechanism.right);
        }
        if (this.resolutionString) {
            code.overwrite(this.source.start, this.source.end, this.resolutionString);
            if (this.namespaceExportName) {
                const [left, right] = getDirectReturnFunction(['n'], {
                    functionReturn: true,
                    lineBreakIndent: null,
                    name: null
                });
                code.prependLeft(this.end, `.then(${left}n.${this.namespaceExportName}${right})`);
            }
        }
        else {
            this.source.render(code, options);
        }
        if (this.assertions !== true) {
            if (this.arguments) {
                code.overwrite(this.source.end, this.end - 1, '', { contentOnly: true });
            }
            if (this.assertions) {
                code.appendLeft(this.end - 1, `,${_}${getObject([['assert', this.assertions]], {
                    lineBreakIndent: null
                })}`);
            }
        }
    }
    setExternalResolution(exportMode, resolution, options, snippets, pluginDriver, accessedGlobalsByScope, resolutionString, namespaceExportName, assertions) {
        const { format } = options;
        this.inlineNamespace = null;
        this.resolution = resolution;
        this.resolutionString = resolutionString;
        this.namespaceExportName = namespaceExportName;
        this.assertions = assertions;
        const accessedGlobals = [...(accessedImportGlobals[format] || [])];
        let helper;
        ({ helper, mechanism: this.mechanism } = this.getDynamicImportMechanismAndHelper(resolution, exportMode, options, snippets, pluginDriver));
        if (helper) {
            accessedGlobals.push(helper);
        }
        if (accessedGlobals.length > 0) {
            this.scope.addAccessedGlobals(accessedGlobals, accessedGlobalsByScope);
        }
    }
    setInternalResolution(inlineNamespace) {
        this.inlineNamespace = inlineNamespace;
    }
    applyDeoptimizations() { }
    getDynamicImportMechanismAndHelper(resolution, exportMode, { compact, dynamicImportFunction, dynamicImportInCjs, format, generatedCode: { arrowFunctions }, interop }, { _, getDirectReturnFunction, getDirectReturnIifeLeft }, pluginDriver) {
        const mechanism = pluginDriver.hookFirstSync('renderDynamicImport', [
            {
                customResolution: typeof this.resolution === 'string' ? this.resolution : null,
                format,
                moduleId: this.context.module.id,
                targetModuleId: this.resolution && typeof this.resolution !== 'string' ? this.resolution.id : null
            }
        ]);
        if (mechanism) {
            return { helper: null, mechanism };
        }
        const hasDynamicTarget = !this.resolution || typeof this.resolution === 'string';
        switch (format) {
            case 'cjs': {
                if (dynamicImportInCjs &&
                    (!resolution || typeof resolution === 'string' || resolution instanceof ExternalModule)) {
                    return { helper: null, mechanism: null };
                }
                const helper = getInteropHelper(resolution, exportMode, interop);
                let left = `require(`;
                let right = `)`;
                if (helper) {
                    left = `/*#__PURE__*/${helper}(${left}`;
                    right += ')';
                }
                const [functionLeft, functionRight] = getDirectReturnFunction([], {
                    functionReturn: true,
                    lineBreakIndent: null,
                    name: null
                });
                left = `Promise.resolve().then(${functionLeft}${left}`;
                right += `${functionRight})`;
                if (!arrowFunctions && hasDynamicTarget) {
                    left = getDirectReturnIifeLeft(['t'], `${left}t${right}`, {
                        needsArrowReturnParens: false,
                        needsWrappedFunction: true
                    });
                    right = ')';
                }
                return {
                    helper,
                    mechanism: { left, right }
                };
            }
            case 'amd': {
                const resolve = compact ? 'c' : 'resolve';
                const reject = compact ? 'e' : 'reject';
                const helper = getInteropHelper(resolution, exportMode, interop);
                const [resolveLeft, resolveRight] = getDirectReturnFunction(['m'], {
                    functionReturn: false,
                    lineBreakIndent: null,
                    name: null
                });
                const resolveNamespace = helper
                    ? `${resolveLeft}${resolve}(/*#__PURE__*/${helper}(m))${resolveRight}`
                    : resolve;
                const [handlerLeft, handlerRight] = getDirectReturnFunction([resolve, reject], {
                    functionReturn: false,
                    lineBreakIndent: null,
                    name: null
                });
                let left = `new Promise(${handlerLeft}require([`;
                let right = `],${_}${resolveNamespace},${_}${reject})${handlerRight})`;
                if (!arrowFunctions && hasDynamicTarget) {
                    left = getDirectReturnIifeLeft(['t'], `${left}t${right}`, {
                        needsArrowReturnParens: false,
                        needsWrappedFunction: true
                    });
                    right = ')';
                }
                return {
                    helper,
                    mechanism: { left, right }
                };
            }
            case 'system': {
                return {
                    helper: null,
                    mechanism: {
                        left: 'module.import(',
                        right: ')'
                    }
                };
            }
            case 'es': {
                if (dynamicImportFunction) {
                    return {
                        helper: null,
                        mechanism: {
                            left: `${dynamicImportFunction}(`,
                            right: ')'
                        }
                    };
                }
            }
        }
        return { helper: null, mechanism: null };
    }
}
function getInteropHelper(resolution, exportMode, interop) {
    return exportMode === 'external'
        ? namespaceInteropHelpersByInteropType[interop(resolution instanceof ExternalModule ? resolution.id : null)]
        : exportMode === 'default'
            ? INTEROP_NAMESPACE_DEFAULT_ONLY_VARIABLE
            : null;
}
const accessedImportGlobals = {
    amd: ['require'],
    cjs: ['require'],
    system: ['module']
};
