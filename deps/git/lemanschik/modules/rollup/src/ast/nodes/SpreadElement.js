import { NODE_INTERACTION_UNKNOWN_ACCESS } from '../NodeInteractions';
import { UNKNOWN_PATH, UnknownKey } from '../utils/PathTracker';
import { NodeBase } from './shared/Node';
export default class SpreadElement extends NodeBase {
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        if (path.length > 0) {
            this.argument.deoptimizeThisOnInteractionAtPath(interaction, [UnknownKey, ...path], recursionTracker);
        }
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        const { propertyReadSideEffects } = this.context.options
            .treeshake;
        return (this.argument.hasEffects(context) ||
            (propertyReadSideEffects &&
                (propertyReadSideEffects === 'always' ||
                    this.argument.hasEffectsOnInteractionAtPath(UNKNOWN_PATH, NODE_INTERACTION_UNKNOWN_ACCESS, context))));
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        // Only properties of properties of the argument could become subject to reassignment
        // This will also reassign the return values of iterators
        this.argument.deoptimizePath([UnknownKey, UnknownKey]);
        this.context.requestTreeshakingPass();
    }
}
