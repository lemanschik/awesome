import ArrowFunctionExpression from './ArrowFunctionExpression';
import FunctionNode from './shared/FunctionNode';
import { NodeBase } from './shared/Node';
export default class AwaitExpression extends NodeBase {
    hasEffects() {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return true;
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        if (!this.included) {
            this.included = true;
            checkTopLevelAwait: if (!this.context.usesTopLevelAwait) {
                let parent = this.parent;
                do {
                    if (parent instanceof FunctionNode || parent instanceof ArrowFunctionExpression)
                        break checkTopLevelAwait;
                } while ((parent = parent.parent));
                this.context.usesTopLevelAwait = true;
            }
        }
        this.argument.include(context, includeChildrenRecursively);
    }
}
