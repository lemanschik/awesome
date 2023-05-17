import { getSafeName } from '../../utils/safeName';
import Scope from './Scope';
export default class ChildScope extends Scope {
    constructor(parent) {
        super();
        this.accessedOutsideVariables = new Map();
        this.parent = parent;
        parent.children.push(this);
    }
    addAccessedDynamicImport(importExpression) {
        (this.accessedDynamicImports || (this.accessedDynamicImports = new Set())).add(importExpression);
        if (this.parent instanceof ChildScope) {
            this.parent.addAccessedDynamicImport(importExpression);
        }
    }
    addAccessedGlobals(globals, accessedGlobalsByScope) {
        const accessedGlobals = accessedGlobalsByScope.get(this) || new Set();
        for (const name of globals) {
            accessedGlobals.add(name);
        }
        accessedGlobalsByScope.set(this, accessedGlobals);
        if (this.parent instanceof ChildScope) {
            this.parent.addAccessedGlobals(globals, accessedGlobalsByScope);
        }
    }
    addNamespaceMemberAccess(name, variable) {
        this.accessedOutsideVariables.set(name, variable);
        this.parent.addNamespaceMemberAccess(name, variable);
    }
    addReturnExpression(expression) {
        this.parent instanceof ChildScope && this.parent.addReturnExpression(expression);
    }
    addUsedOutsideNames(usedNames, format, exportNamesByVariable, accessedGlobalsByScope) {
        for (const variable of this.accessedOutsideVariables.values()) {
            if (variable.included) {
                usedNames.add(variable.getBaseVariableName());
                if (format === 'system' && exportNamesByVariable.has(variable)) {
                    usedNames.add('exports');
                }
            }
        }
        const accessedGlobals = accessedGlobalsByScope.get(this);
        if (accessedGlobals) {
            for (const name of accessedGlobals) {
                usedNames.add(name);
            }
        }
    }
    contains(name) {
        return this.variables.has(name) || this.parent.contains(name);
    }
    deconflict(format, exportNamesByVariable, accessedGlobalsByScope) {
        const usedNames = new Set();
        this.addUsedOutsideNames(usedNames, format, exportNamesByVariable, accessedGlobalsByScope);
        if (this.accessedDynamicImports) {
            for (const importExpression of this.accessedDynamicImports) {
                if (importExpression.inlineNamespace) {
                    usedNames.add(importExpression.inlineNamespace.getBaseVariableName());
                }
            }
        }
        for (const [name, variable] of this.variables) {
            if (variable.included || variable.alwaysRendered) {
                variable.setRenderNames(null, getSafeName(name, usedNames, variable.forbiddenNames));
            }
        }
        for (const scope of this.children) {
            scope.deconflict(format, exportNamesByVariable, accessedGlobalsByScope);
        }
    }
    findLexicalBoundary() {
        return this.parent.findLexicalBoundary();
    }
    findVariable(name) {
        const knownVariable = this.variables.get(name) || this.accessedOutsideVariables.get(name);
        if (knownVariable) {
            return knownVariable;
        }
        const variable = this.parent.findVariable(name);
        this.accessedOutsideVariables.set(name, variable);
        return variable;
    }
}
