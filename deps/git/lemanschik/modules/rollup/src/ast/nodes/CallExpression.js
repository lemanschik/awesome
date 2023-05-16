import { BLANK } from '../../utils/blank';
import { errorCannotCallNamespace, errorEval } from '../../utils/error';
import { renderCallArguments } from '../../utils/renderCallArguments';
import { INTERACTION_CALLED } from '../NodeInteractions';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, UNKNOWN_PATH } from '../utils/PathTracker';
import Identifier from './Identifier';
import MemberExpression from './MemberExpression';
import CallExpressionBase from './shared/CallExpressionBase';
import { UNKNOWN_RETURN_EXPRESSION } from './shared/Expression';
import { INCLUDE_PARAMETERS } from './shared/Node';
export default class CallExpression extends CallExpressionBase {
    bind() {
        super.bind();
        if (this.callee instanceof Identifier) {
            const variable = this.scope.findVariable(this.callee.name);
            if (variable.isNamespace) {
                this.context.warn(errorCannotCallNamespace(this.callee.name), this.start);
            }
            if (this.callee.name === 'eval') {
                this.context.warn(errorEval(this.context.module.id), this.start);
            }
        }
        this.interaction = {
            args: this.arguments,
            thisArg: this.callee instanceof MemberExpression && !this.callee.variable
                ? this.callee.object
                : null,
            type: INTERACTION_CALLED,
            withNew: false
        };
    }
    hasEffects(context) {
        try {
            for (const argument of this.arguments) {
                if (argument.hasEffects(context))
                    return true;
            }
            if (this.context.options.treeshake.annotations &&
                this.annotations)
                return false;
            return (this.callee.hasEffects(context) ||
                this.callee.hasEffectsOnInteractionAtPath(EMPTY_PATH, this.interaction, context));
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
            if (includeChildrenRecursively === INCLUDE_PARAMETERS &&
                this.callee instanceof Identifier &&
                this.callee.variable) {
                this.callee.variable.markCalledFromTryStatement();
            }
        }
        else {
            this.included = true;
            this.callee.include(context, false);
        }
        this.callee.includeCallArguments(context, this.arguments);
    }
    render(code, options, { renderedSurroundingElement } = BLANK) {
        this.callee.render(code, options, {
            isCalleeOfRenderedParent: true,
            renderedSurroundingElement
        });
        renderCallArguments(code, options, this);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        if (this.interaction.thisArg) {
            this.callee.deoptimizeThisOnInteractionAtPath(this.interaction, EMPTY_PATH, SHARED_RECURSION_TRACKER);
        }
        for (const argument of this.arguments) {
            // This will make sure all properties of parameters behave as "unknown"
            argument.deoptimizePath(UNKNOWN_PATH);
        }
        this.context.requestTreeshakingPass();
    }
    getReturnExpression(recursionTracker = SHARED_RECURSION_TRACKER) {
        if (this.returnExpression === null) {
            this.returnExpression = UNKNOWN_RETURN_EXPRESSION;
            return (this.returnExpression = this.callee.getReturnExpressionWhenCalledAtPath(EMPTY_PATH, this.interaction, recursionTracker, this));
        }
        return this.returnExpression;
    }
}
