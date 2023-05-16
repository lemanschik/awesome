import { ExpressionEntity } from './Expression';
export class MultiExpression extends ExpressionEntity {
    constructor(expressions) {
        super();
        this.expressions = expressions;
        this.included = false;
    }
    deoptimizePath(path) {
        for (const expression of this.expressions) {
            expression.deoptimizePath(path);
        }
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        return [
            new MultiExpression(this.expressions.map(expression => expression.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin)[0])),
            false
        ];
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        for (const expression of this.expressions) {
            if (expression.hasEffectsOnInteractionAtPath(path, interaction, context))
                return true;
        }
        return false;
    }
}
