import { BROKEN_FLOW_NONE } from '../../ExecutionContext';
import { INTERACTION_CALLED, NODE_INTERACTION_UNKNOWN_ACCESS, NODE_INTERACTION_UNKNOWN_CALL } from '../../NodeInteractions';
import { UNKNOWN_PATH, UnknownKey } from '../../utils/PathTracker';
import BlockStatement from '../BlockStatement';
import * as NodeType from '../NodeType';
import RestElement from '../RestElement';
import { UNKNOWN_EXPRESSION, UNKNOWN_RETURN_EXPRESSION } from './Expression';
import { NodeBase } from './Node';
export default class FunctionBase extends NodeBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
        this.deoptimizedReturn = false;
    }
    deoptimizePath(path) {
        this.getObjectEntity().deoptimizePath(path);
        if (path.length === 1 && path[0] === UnknownKey) {
            // A reassignment of UNKNOWN_PATH is considered equivalent to having lost track
            // which means the return expression needs to be reassigned
            this.scope.getReturnExpression().deoptimizePath(UNKNOWN_PATH);
        }
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        if (path.length > 0) {
            this.getObjectEntity().deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
        }
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.getObjectEntity().getLiteralValueAtPath(path, recursionTracker, origin);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        if (path.length > 0) {
            return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
        }
        if (this.async) {
            if (!this.deoptimizedReturn) {
                this.deoptimizedReturn = true;
                this.scope.getReturnExpression().deoptimizePath(UNKNOWN_PATH);
                this.context.requestTreeshakingPass();
            }
            return UNKNOWN_RETURN_EXPRESSION;
        }
        return [this.scope.getReturnExpression(), false];
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (path.length > 0 || interaction.type !== INTERACTION_CALLED) {
            return this.getObjectEntity().hasEffectsOnInteractionAtPath(path, interaction, context);
        }
        if (this.async) {
            const { propertyReadSideEffects } = this.context.options
                .treeshake;
            const returnExpression = this.scope.getReturnExpression();
            if (returnExpression.hasEffectsOnInteractionAtPath(['then'], NODE_INTERACTION_UNKNOWN_CALL, context) ||
                (propertyReadSideEffects &&
                    (propertyReadSideEffects === 'always' ||
                        returnExpression.hasEffectsOnInteractionAtPath(['then'], NODE_INTERACTION_UNKNOWN_ACCESS, context)))) {
                return true;
            }
        }
        for (const parameter of this.params) {
            if (parameter.hasEffects(context))
                return true;
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        this.included = true;
        const { brokenFlow } = context;
        context.brokenFlow = BROKEN_FLOW_NONE;
        this.body.include(context, includeChildrenRecursively);
        context.brokenFlow = brokenFlow;
    }
    includeCallArguments(context, parameters) {
        this.scope.includeCallArguments(context, parameters);
    }
    initialise() {
        this.scope.addParameterVariables(this.params.map(parameter => parameter.declare('parameter', UNKNOWN_EXPRESSION)), this.params[this.params.length - 1] instanceof RestElement);
        if (this.body instanceof BlockStatement) {
            this.body.addImplicitReturnExpressionToScope();
        }
        else {
            this.scope.addReturnExpression(this.body);
        }
    }
    parseNode(esTreeNode) {
        if (esTreeNode.body.type === NodeType.BlockStatement) {
            this.body = new BlockStatement(esTreeNode.body, this, this.scope.hoistedBodyVarScope);
        }
        super.parseNode(esTreeNode);
    }
    applyDeoptimizations() { }
}
FunctionBase.prototype.preventChildBlockScope = true;
