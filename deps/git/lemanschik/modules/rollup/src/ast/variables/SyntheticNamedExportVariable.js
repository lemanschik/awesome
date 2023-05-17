import ExportDefaultVariable from './ExportDefaultVariable';
import Variable from './Variable';
export default class SyntheticNamedExportVariable extends Variable {
    constructor(context, name, syntheticNamespace) {
        super(name);
        this.baseVariable = null;
        this.context = context;
        this.module = context.module;
        this.syntheticNamespace = syntheticNamespace;
    }
    getBaseVariable() {
        if (this.baseVariable)
            return this.baseVariable;
        let baseVariable = this.syntheticNamespace;
        while (baseVariable instanceof ExportDefaultVariable ||
            baseVariable instanceof SyntheticNamedExportVariable) {
            if (baseVariable instanceof ExportDefaultVariable) {
                const original = baseVariable.getOriginalVariable();
                if (original === baseVariable)
                    break;
                baseVariable = original;
            }
            if (baseVariable instanceof SyntheticNamedExportVariable) {
                baseVariable = baseVariable.syntheticNamespace;
            }
        }
        return (this.baseVariable = baseVariable);
    }
    getBaseVariableName() {
        return this.syntheticNamespace.getBaseVariableName();
    }
    getName(getPropertyAccess) {
        return `${this.syntheticNamespace.getName(getPropertyAccess)}${getPropertyAccess(this.name)}`;
    }
    include() {
        this.included = true;
        this.context.includeVariableInModule(this.syntheticNamespace);
    }
    setRenderNames(baseName, name) {
        super.setRenderNames(baseName, name);
    }
}
