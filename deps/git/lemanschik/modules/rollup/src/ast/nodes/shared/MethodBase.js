import { INTERACTION_ACCESSED, INTERACTION_ASSIGNED, INTERACTION_CALLED, NO_ARGS, NODE_INTERACTION_UNKNOWN_CALL } from '../../NodeInteractions';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER } from '../../utils/PathTracker';
import { UNKNOWN_RETURN_EXPRESSION } from './Expression';
import { NodeBase } from './Node';
export default class MethodBase extends NodeBase {
    constructor() {
        super(...arguments);
        this.accessedValue = null;
    }
    // As getter properties directly receive their values from fixed function
    // expressions, there is no known situation where a getter is deoptimized.
    deoptimizeCache() { }
    deoptimizePath(path) {
        this.getAccessedValue()[0].deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        if (interaction.type === INTERACTION_ACCESSED && this.kind === 'get' && path.length === 0) {
            return this.value.deoptimizeThisOnInteractionAtPath({
                args: NO_ARGS,
                thisArg: interaction.thisArg,
                type: INTERACTION_CALLED,
                withNew: false
            }, EMPTY_PATH, recursionTracker);
        }
        if (interaction.type === INTERACTION_ASSIGNED && this.kind === 'set' && path.length === 0) {
            return this.value.deoptimizeThisOnInteractionAtPath({
                args: interaction.args,
                thisArg: interaction.thisArg,
                type: INTERACTION_CALLED,
                withNew: false
            }, EMPTY_PATH, recursionTracker);
        }
        this.getAccessedValue()[0].deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.getAccessedValue()[0].getLiteralValueAtPath(path, recursionTracker, origin);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        return this.getAccessedValue()[0].getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
    }
    hasEffects(context) {
        return this.key.hasEffects(context);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (this.kind === 'get' && interaction.type === INTERACTION_ACCESSED && path.length === 0) {
            return this.value.hasEffectsOnInteractionAtPath(EMPTY_PATH, {
                args: NO_ARGS,
                thisArg: interaction.thisArg,
                type: INTERACTION_CALLED,
                withNew: false
            }, context);
        }
        // setters are only called for empty paths
        if (this.kind === 'set' && interaction.type === INTERACTION_ASSIGNED) {
            return this.value.hasEffectsOnInteractionAtPath(EMPTY_PATH, {
                args: interaction.args,
                thisArg: interaction.thisArg,
                type: INTERACTION_CALLED,
                withNew: false
            }, context);
        }
        return this.getAccessedValue()[0].hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    applyDeoptimizations() { }
    getAccessedValue() {
        if (this.accessedValue === null) {
            if (this.kind === 'get') {
                this.accessedValue = UNKNOWN_RETURN_EXPRESSION;
                return (this.accessedValue = this.value.getReturnExpressionWhenCalledAtPath(EMPTY_PATH, NODE_INTERACTION_UNKNOWN_CALL, SHARED_RECURSION_TRACKER, this));
            }
            else {
                return (this.accessedValue = [this.value, false]);
            }
        }
        return this.accessedValue;
    }
}
