import { BLANK } from '../../utils/blank';
import { EMPTY_PATH, UNKNOWN_PATH } from '../utils/PathTracker';
import { NodeBase } from './shared/Node';
export default class AssignmentPattern extends NodeBase {
    addExportedVariables(variables, exportNamesByVariable) {
        this.left.addExportedVariables(variables, exportNamesByVariable);
    }
    declare(kind, init) {
        return this.left.declare(kind, init);
    }
    deoptimizePath(path) {
        path.length === 0 && this.left.deoptimizePath(path);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return (path.length > 0 || this.left.hasEffectsOnInteractionAtPath(EMPTY_PATH, interaction, context));
    }
    markDeclarationReached() {
        this.left.markDeclarationReached();
    }
    render(code, options, { isShorthandProperty } = BLANK) {
        this.left.render(code, options, { isShorthandProperty });
        this.right.render(code, options);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        this.left.deoptimizePath(EMPTY_PATH);
        this.right.deoptimizePath(UNKNOWN_PATH);
        this.context.requestTreeshakingPass();
    }
}
