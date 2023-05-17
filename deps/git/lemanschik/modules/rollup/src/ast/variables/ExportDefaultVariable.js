import ClassDeclaration from '../nodes/ClassDeclaration';
import FunctionDeclaration from '../nodes/FunctionDeclaration';
import Identifier from '../nodes/Identifier';
import LocalVariable from './LocalVariable';
import UndefinedVariable from './UndefinedVariable';
export default class ExportDefaultVariable extends LocalVariable {
    constructor(name, exportDefaultDeclaration, context) {
        super(name, exportDefaultDeclaration, exportDefaultDeclaration.declaration, context);
        this.hasId = false;
        this.originalId = null;
        this.originalVariable = null;
        const declaration = exportDefaultDeclaration.declaration;
        if ((declaration instanceof FunctionDeclaration || declaration instanceof ClassDeclaration) &&
            declaration.id) {
            this.hasId = true;
            this.originalId = declaration.id;
        }
        else if (declaration instanceof Identifier) {
            this.originalId = declaration;
        }
    }
    addReference(identifier) {
        if (!this.hasId) {
            this.name = identifier.name;
        }
    }
    getAssignedVariableName() {
        return (this.originalId && this.originalId.name) || null;
    }
    getBaseVariableName() {
        const original = this.getOriginalVariable();
        return original === this ? super.getBaseVariableName() : original.getBaseVariableName();
    }
    getDirectOriginalVariable() {
        return this.originalId &&
            (this.hasId ||
                !(this.originalId.isPossibleTDZ() ||
                    this.originalId.variable.isReassigned ||
                    this.originalId.variable instanceof UndefinedVariable ||
                    // this avoids a circular dependency
                    'syntheticNamespace' in this.originalId.variable))
            ? this.originalId.variable
            : null;
    }
    getName(getPropertyAccess) {
        const original = this.getOriginalVariable();
        return original === this
            ? super.getName(getPropertyAccess)
            : original.getName(getPropertyAccess);
    }
    getOriginalVariable() {
        if (this.originalVariable)
            return this.originalVariable;
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let original = this;
        let currentVariable;
        const checkedVariables = new Set();
        do {
            checkedVariables.add(original);
            currentVariable = original;
            original = currentVariable.getDirectOriginalVariable();
        } while (original instanceof ExportDefaultVariable && !checkedVariables.has(original));
        return (this.originalVariable = original || currentVariable);
    }
}
