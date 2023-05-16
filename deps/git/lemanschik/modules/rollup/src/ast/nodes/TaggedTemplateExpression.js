import { errorCannotCallNamespace } from '../../utils/error';
import { INTERACTION_CALLED } from '../NodeInteractions';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, UNKNOWN_PATH } from '../utils/PathTracker';
import MemberExpression from './MemberExpression';
import * as NodeType from './NodeType';
import CallExpressionBase from './shared/CallExpressionBase';
import { UNKNOWN_EXPRESSION, UNKNOWN_RETURN_EXPRESSION } from './shared/Expression';
export default class TaggedTemplateExpression extends CallExpressionBase {
    bind() {
        super.bind();
        if (this.tag.type === NodeType.Identifier) {
            const name = this.tag.name;
            const variable = this.scope.findVariable(name);
            if (variable.isNamespace) {
                this.context.warn(errorCannotCallNamespace(name), this.start);
            }
        }
    }
    hasEffects(context) {
        try {
            for (const argument of this.quasi.expressions) {
                if (argument.hasEffects(context))
                    return true;
            }
            return (this.tag.hasEffects(context) ||
                this.tag.hasEffectsOnInteractionAtPath(EMPTY_PATH, this.interaction, context));
        }
        finally {
            if (!this.deoptimized)
                this.applyDeoptimizations();
        }
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        if (includeChildrenRecursively) {
            super.include(context, includeChildrenRecursively);
        }
        else {
            this.included = true;
            this.tag.include(context, includeChildrenRecursively);
            this.quasi.include(context, includeChildrenRecursively);
        }
        this.tag.includeCallArguments(context, this.interaction.args);
        const [returnExpression] = this.getReturnExpression();
        if (!returnExpression.included) {
            returnExpression.include(context, false);
        }
    }
    initialise() {
        this.interaction = {
            args: [UNKNOWN_EXPRESSION, ...this.quasi.expressions],
            thisArg: this.tag instanceof MemberExpression && !this.tag.variable ? this.tag.object : null,
            type: INTERACTION_CALLED,
            withNew: false
        };
    }
    render(code, options) {
        this.tag.render(code, options, { isCalleeOfRenderedParent: true });
        this.quasi.render(code, options);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        if (this.interaction.thisArg) {
            this.tag.deoptimizeThisOnInteractionAtPath(this.interaction, EMPTY_PATH, SHARED_RECURSION_TRACKER);
        }
        for (const argument of this.quasi.expressions) {
            // This will make sure all properties of parameters behave as "unknown"
            argument.deoptimizePath(UNKNOWN_PATH);
        }
        this.context.requestTreeshakingPass();
    }
    getReturnExpression(recursionTracker = SHARED_RECURSION_TRACKER) {
        if (this.returnExpression === null) {
            this.returnExpression = UNKNOWN_RETURN_EXPRESSION;
            return (this.returnExpression = this.tag.getReturnExpressionWhenCalledAtPath(EMPTY_PATH, this.interaction, recursionTracker, this));
        }
        return this.returnExpression;
    }
}
