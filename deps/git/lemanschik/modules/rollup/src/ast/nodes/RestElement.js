import { EMPTY_PATH, UnknownKey } from '../utils/PathTracker';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class RestElement extends NodeBase {
    constructor() {
        super(...arguments);
        this.declarationInit = null;
    }
    addExportedVariables(variables, exportNamesByVariable) {
        this.argument.addExportedVariables(variables, exportNamesByVariable);
    }
    declare(kind, init) {
        this.declarationInit = init;
        return this.argument.declare(kind, UNKNOWN_EXPRESSION);
    }
    deoptimizePath(path) {
        path.length === 0 && this.argument.deoptimizePath(EMPTY_PATH);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return (path.length > 0 ||
            this.argument.hasEffectsOnInteractionAtPath(EMPTY_PATH, interaction, context));
    }
    markDeclarationReached() {
        this.argument.markDeclarationReached();
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        if (this.declarationInit !== null) {
            this.declarationInit.deoptimizePath([UnknownKey, UnknownKey]);
            this.context.requestTreeshakingPass();
        }
    }
}
