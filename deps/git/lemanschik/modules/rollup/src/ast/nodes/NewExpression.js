import { renderCallArguments } from '../../utils/renderCallArguments';
import { INTERACTION_ACCESSED, INTERACTION_CALLED } from '../NodeInteractions';
import { EMPTY_PATH, UNKNOWN_PATH } from '../utils/PathTracker';
import { NodeBase } from './shared/Node';
export default class NewExpression extends NodeBase {
    hasEffects(context) {
        try {
            for (const argument of this.arguments) {
                if (argument.hasEffects(context))
                    return true;
            }
            if (this.context.options.treeshake.annotations &&
                this.annotations) {
                return false;
            }
            return (this.callee.hasEffects(context) ||
                this.callee.hasEffectsOnInteractionAtPath(EMPTY_PATH, this.interaction, context));
        }
        finally {
            if (!this.deoptimized)
                this.applyDeoptimizations();
        }
    }
    hasEffectsOnInteractionAtPath(path, { type }) {
        return path.length > 0 || type !== INTERACTION_ACCESSED;
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        if (includeChildrenRecursively) {
            super.include(context, includeChildrenRecursively);
        }
        else {
            this.included = true;
            this.callee.include(context, false);
        }
        this.callee.includeCallArguments(context, this.arguments);
    }
    initialise() {
        this.interaction = {
            args: this.arguments,
            thisArg: null,
            type: INTERACTION_CALLED,
            withNew: true
        };
    }
    render(code, options) {
        this.callee.render(code, options);
        renderCallArguments(code, options, this);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        for (const argument of this.arguments) {
            // This will make sure all properties of parameters behave as "unknown"
            argument.deoptimizePath(UNKNOWN_PATH);
        }
        this.context.requestTreeshakingPass();
    }
}
