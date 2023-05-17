import { BROKEN_FLOW_ERROR_RETURN_LABEL } from '../ExecutionContext';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import { StatementBase } from './shared/Node';
export default class ReturnStatement extends StatementBase {
    hasEffects(context) {
        if (!context.ignore.returnYield || this.argument?.hasEffects(context))
            return true;
        context.brokenFlow = BROKEN_FLOW_ERROR_RETURN_LABEL;
        return false;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        this.argument?.include(context, includeChildrenRecursively);
        context.brokenFlow = BROKEN_FLOW_ERROR_RETURN_LABEL;
    }
    initialise() {
        this.scope.addReturnExpression(this.argument || UNKNOWN_EXPRESSION);
    }
    render(code, options) {
        if (this.argument) {
            this.argument.render(code, options, { preventASI: true });
            if (this.argument.start === this.start + 6 /* 'return'.length */) {
                code.prependLeft(this.start + 6, ' ');
            }
        }
    }
}
