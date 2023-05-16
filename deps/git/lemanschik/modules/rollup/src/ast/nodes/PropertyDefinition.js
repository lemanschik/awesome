import { UNKNOWN_RETURN_EXPRESSION, UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class PropertyDefinition extends NodeBase {
    deoptimizePath(path) {
        this.value?.deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.value?.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.value
            ? this.value.getLiteralValueAtPath(path, recursionTracker, origin)
            : UnknownValue;
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        return this.value
            ? this.value.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin)
            : UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffects(context) {
        return this.key.hasEffects(context) || (this.static && !!this.value?.hasEffects(context));
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return !this.value || this.value.hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    applyDeoptimizations() { }
}
