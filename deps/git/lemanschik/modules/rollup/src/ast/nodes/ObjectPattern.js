import { EMPTY_PATH } from '../utils/PathTracker';
import * as NodeType from './NodeType';
import { NodeBase } from './shared/Node';
export default class ObjectPattern extends NodeBase {
    addExportedVariables(variables, exportNamesByVariable) {
        for (const property of this.properties) {
            if (property.type === NodeType.Property) {
                property.value.addExportedVariables(variables, exportNamesByVariable);
            }
            else {
                property.argument.addExportedVariables(variables, exportNamesByVariable);
            }
        }
    }
    declare(kind, init) {
        const variables = [];
        for (const property of this.properties) {
            variables.push(...property.declare(kind, init));
        }
        return variables;
    }
    deoptimizePath(path) {
        if (path.length === 0) {
            for (const property of this.properties) {
                property.deoptimizePath(path);
            }
        }
    }
    hasEffectsOnInteractionAtPath(
    // At the moment, this is only triggered for assignment left-hand sides,
    // where the path is empty
    _path, interaction, context) {
        for (const property of this.properties) {
            if (property.hasEffectsOnInteractionAtPath(EMPTY_PATH, interaction, context))
                return true;
        }
        return false;
    }
    markDeclarationReached() {
        for (const property of this.properties) {
            property.markDeclarationReached();
        }
    }
}
