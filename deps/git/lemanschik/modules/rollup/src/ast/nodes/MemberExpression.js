import { BLANK } from '../../utils/blank';
import { errorIllegalImportReassignment, errorMissingExport } from '../../utils/error';
import { INTERACTION_ACCESSED, INTERACTION_ASSIGNED } from '../NodeInteractions';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, SymbolToStringTag, UNKNOWN_PATH, UnknownKey, UnknownNonAccessorKey } from '../utils/PathTracker';
import { UNDEFINED_EXPRESSION } from '../values';
import ExternalVariable from '../variables/ExternalVariable';
import Identifier from './Identifier';
import Literal from './Literal';
import { UNKNOWN_RETURN_EXPRESSION, UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
// To avoid infinite recursions
const MAX_PATH_DEPTH = 7;
function getResolvablePropertyKey(memberExpression) {
    return memberExpression.computed
        ? getResolvableComputedPropertyKey(memberExpression.property)
        : memberExpression.property.name;
}
function getResolvableComputedPropertyKey(propertyKey) {
    if (propertyKey instanceof Literal) {
        return String(propertyKey.value);
    }
    return null;
}
function getPathIfNotComputed(memberExpression) {
    const nextPathKey = memberExpression.propertyKey;
    const object = memberExpression.object;
    if (typeof nextPathKey === 'string') {
        if (object instanceof Identifier) {
            return [
                { key: object.name, pos: object.start },
                { key: nextPathKey, pos: memberExpression.property.start }
            ];
        }
        if (object instanceof MemberExpression) {
            const parentPath = getPathIfNotComputed(object);
            return (parentPath && [...parentPath, { key: nextPathKey, pos: memberExpression.property.start }]);
        }
    }
    return null;
}
function getStringFromPath(path) {
    let pathString = path[0].key;
    for (let index = 1; index < path.length; index++) {
        pathString += '.' + path[index].key;
    }
    return pathString;
}
export default class MemberExpression extends NodeBase {
    constructor() {
        super(...arguments);
        this.variable = null;
        this.assignmentDeoptimized = false;
        this.bound = false;
        this.expressionsToBeDeoptimized = [];
        this.isUndefined = false;
    }
    bind() {
        this.bound = true;
        const path = getPathIfNotComputed(this);
        const baseVariable = path && this.scope.findVariable(path[0].key);
        if (baseVariable && baseVariable.isNamespace) {
            const resolvedVariable = resolveNamespaceVariables(baseVariable, path.slice(1), this.context);
            if (!resolvedVariable) {
                super.bind();
            }
            else if (resolvedVariable === 'undefined') {
                this.isUndefined = true;
            }
            else {
                this.variable = resolvedVariable;
                this.scope.addNamespaceMemberAccess(getStringFromPath(path), resolvedVariable);
            }
        }
        else {
            super.bind();
        }
    }
    deoptimizeCache() {
        const expressionsToBeDeoptimized = this.expressionsToBeDeoptimized;
        this.expressionsToBeDeoptimized = [];
        this.propertyKey = UnknownKey;
        this.object.deoptimizePath(UNKNOWN_PATH);
        for (const expression of expressionsToBeDeoptimized) {
            expression.deoptimizeCache();
        }
    }
    deoptimizePath(path) {
        if (path.length === 0)
            this.disallowNamespaceReassignment();
        if (this.variable) {
            this.variable.deoptimizePath(path);
        }
        else if (!this.isUndefined && path.length < MAX_PATH_DEPTH) {
            const propertyKey = this.getPropertyKey();
            this.object.deoptimizePath([
                propertyKey === UnknownKey ? UnknownNonAccessorKey : propertyKey,
                ...path
            ]);
        }
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        if (this.variable) {
            this.variable.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
        }
        else if (!this.isUndefined) {
            if (path.length < MAX_PATH_DEPTH) {
                this.object.deoptimizeThisOnInteractionAtPath(interaction, [this.getPropertyKey(), ...path], recursionTracker);
            }
            else {
                interaction.thisArg.deoptimizePath(UNKNOWN_PATH);
            }
        }
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        if (this.variable) {
            return this.variable.getLiteralValueAtPath(path, recursionTracker, origin);
        }
        if (this.isUndefined) {
            return undefined;
        }
        this.expressionsToBeDeoptimized.push(origin);
        if (path.length < MAX_PATH_DEPTH) {
            return this.object.getLiteralValueAtPath([this.getPropertyKey(), ...path], recursionTracker, origin);
        }
        return UnknownValue;
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        if (this.variable) {
            return this.variable.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
        }
        if (this.isUndefined) {
            return [UNDEFINED_EXPRESSION, false];
        }
        this.expressionsToBeDeoptimized.push(origin);
        if (path.length < MAX_PATH_DEPTH) {
            return this.object.getReturnExpressionWhenCalledAtPath([this.getPropertyKey(), ...path], interaction, recursionTracker, origin);
        }
        return UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return (this.property.hasEffects(context) ||
            this.object.hasEffects(context) ||
            this.hasAccessEffect(context));
    }
    hasEffectsAsAssignmentTarget(context, checkAccess) {
        if (checkAccess && !this.deoptimized)
            this.applyDeoptimizations();
        if (!this.assignmentDeoptimized)
            this.applyAssignmentDeoptimization();
        return (this.property.hasEffects(context) ||
            this.object.hasEffects(context) ||
            (checkAccess && this.hasAccessEffect(context)) ||
            this.hasEffectsOnInteractionAtPath(EMPTY_PATH, this.assignmentInteraction, context));
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (this.variable) {
            return this.variable.hasEffectsOnInteractionAtPath(path, interaction, context);
        }
        if (this.isUndefined) {
            return true;
        }
        if (path.length < MAX_PATH_DEPTH) {
            return this.object.hasEffectsOnInteractionAtPath([this.getPropertyKey(), ...path], interaction, context);
        }
        return true;
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        this.includeProperties(context, includeChildrenRecursively);
    }
    includeAsAssignmentTarget(context, includeChildrenRecursively, deoptimizeAccess) {
        if (!this.assignmentDeoptimized)
            this.applyAssignmentDeoptimization();
        if (deoptimizeAccess) {
            this.include(context, includeChildrenRecursively);
        }
        else {
            this.includeProperties(context, includeChildrenRecursively);
        }
    }
    includeCallArguments(context, parameters) {
        if (this.variable) {
            this.variable.includeCallArguments(context, parameters);
        }
        else {
            super.includeCallArguments(context, parameters);
        }
    }
    initialise() {
        this.propertyKey = getResolvablePropertyKey(this);
        this.accessInteraction = { thisArg: this.object, type: INTERACTION_ACCESSED };
    }
    render(code, options, { renderedParentType, isCalleeOfRenderedParent, renderedSurroundingElement } = BLANK) {
        if (this.variable || this.isUndefined) {
            const { snippets: { getPropertyAccess } } = options;
            let replacement = this.variable ? this.variable.getName(getPropertyAccess) : 'undefined';
            if (renderedParentType && isCalleeOfRenderedParent)
                replacement = '0, ' + replacement;
            code.overwrite(this.start, this.end, replacement, {
                contentOnly: true,
                storeName: true
            });
        }
        else {
            if (renderedParentType && isCalleeOfRenderedParent) {
                code.appendRight(this.start, '0, ');
            }
            this.object.render(code, options, { renderedSurroundingElement });
            this.property.render(code, options);
        }
    }
    setAssignedValue(value) {
        this.assignmentInteraction = {
            args: [value],
            thisArg: this.object,
            type: INTERACTION_ASSIGNED
        };
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        const { propertyReadSideEffects } = this.context.options
            .treeshake;
        if (
        // Namespaces are not bound and should not be deoptimized
        this.bound &&
            propertyReadSideEffects &&
            !(this.variable || this.isUndefined)) {
            const propertyKey = this.getPropertyKey();
            this.object.deoptimizeThisOnInteractionAtPath(this.accessInteraction, [propertyKey], SHARED_RECURSION_TRACKER);
            this.context.requestTreeshakingPass();
        }
    }
    applyAssignmentDeoptimization() {
        this.assignmentDeoptimized = true;
        const { propertyReadSideEffects } = this.context.options
            .treeshake;
        if (
        // Namespaces are not bound and should not be deoptimized
        this.bound &&
            propertyReadSideEffects &&
            !(this.variable || this.isUndefined)) {
            this.object.deoptimizeThisOnInteractionAtPath(this.assignmentInteraction, [this.getPropertyKey()], SHARED_RECURSION_TRACKER);
            this.context.requestTreeshakingPass();
        }
    }
    disallowNamespaceReassignment() {
        if (this.object instanceof Identifier) {
            const variable = this.scope.findVariable(this.object.name);
            if (variable.isNamespace) {
                if (this.variable) {
                    this.context.includeVariableInModule(this.variable);
                }
                this.context.warn(errorIllegalImportReassignment(this.object.name, this.context.module.id), this.start);
            }
        }
    }
    getPropertyKey() {
        if (this.propertyKey === null) {
            this.propertyKey = UnknownKey;
            const value = this.property.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, this);
            return (this.propertyKey =
                value === SymbolToStringTag
                    ? value
                    : typeof value === 'symbol'
                        ? UnknownKey
                        : String(value));
        }
        return this.propertyKey;
    }
    hasAccessEffect(context) {
        const { propertyReadSideEffects } = this.context.options
            .treeshake;
        return (!(this.variable || this.isUndefined) &&
            propertyReadSideEffects &&
            (propertyReadSideEffects === 'always' ||
                this.object.hasEffectsOnInteractionAtPath([this.getPropertyKey()], this.accessInteraction, context)));
    }
    includeProperties(context, includeChildrenRecursively) {
        if (!this.included) {
            this.included = true;
            if (this.variable) {
                this.context.includeVariableInModule(this.variable);
            }
        }
        this.object.include(context, includeChildrenRecursively);
        this.property.include(context, includeChildrenRecursively);
    }
}
function resolveNamespaceVariables(baseVariable, path, astContext) {
    if (path.length === 0)
        return baseVariable;
    if (!baseVariable.isNamespace || baseVariable instanceof ExternalVariable)
        return null;
    const exportName = path[0].key;
    const variable = baseVariable.context.traceExport(exportName);
    if (!variable) {
        const fileName = baseVariable.context.fileName;
        astContext.warn(errorMissingExport(exportName, astContext.module.id, fileName), path[0].pos);
        return 'undefined';
    }
    return resolveNamespaceVariables(variable, path.slice(1), astContext);
}
