import { EMPTY_PATH } from '../utils/PathTracker';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class ArrayPattern extends NodeBase {
    addExportedVariables(variables, exportNamesByVariable) {
        for (const element of this.elements) {
            element?.addExportedVariables(variables, exportNamesByVariable);
        }
    }
    declare(kind) {
        const variables = [];
        for (const element of this.elements) {
            if (element !== null) {
                variables.push(...element.declare(kind, UNKNOWN_EXPRESSION));
            }
        }
        return variables;
    }
    // Patterns can only be deoptimized at the empty path at the moment
    deoptimizePath() {
        for (const element of this.elements) {
            element?.deoptimizePath(EMPTY_PATH);
        }
    }
    // Patterns are only checked at the emtpy path at the moment
    hasEffectsOnInteractionAtPath(_path, interaction, context) {
        for (const element of this.elements) {
            if (element?.hasEffectsOnInteractionAtPath(EMPTY_PATH, interaction, context))
                return true;
        }
        return false;
    }
    markDeclarationReached() {
        for (const element of this.elements) {
            element?.markDeclarationReached();
        }
    }
}
