import { UNKNOWN_EXPRESSION } from '../nodes/shared/Expression';
import { UNKNOWN_PATH } from '../utils/PathTracker';
import ParameterScope from './ParameterScope';
export default class ReturnValueScope extends ParameterScope {
    constructor() {
        super(...arguments);
        this.returnExpression = null;
        this.returnExpressions = [];
    }
    addReturnExpression(expression) {
        this.returnExpressions.push(expression);
    }
    getReturnExpression() {
        if (this.returnExpression === null)
            this.updateReturnExpression();
        return this.returnExpression;
    }
    updateReturnExpression() {
        if (this.returnExpressions.length === 1) {
            this.returnExpression = this.returnExpressions[0];
        }
        else {
            this.returnExpression = UNKNOWN_EXPRESSION;
            for (const expression of this.returnExpressions) {
                expression.deoptimizePath(UNKNOWN_PATH);
            }
        }
    }
}
