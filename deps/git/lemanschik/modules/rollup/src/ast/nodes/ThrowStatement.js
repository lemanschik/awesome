import { BROKEN_FLOW_ERROR_RETURN_LABEL } from '../ExecutionContext';
import { StatementBase } from './shared/Node';
export default class ThrowStatement extends StatementBase {
    hasEffects() {
        return true;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        this.argument.include(context, includeChildrenRecursively);
        context.brokenFlow = BROKEN_FLOW_ERROR_RETURN_LABEL;
    }
    render(code, options) {
        this.argument.render(code, options, { preventASI: true });
        if (this.argument.start === this.start + 5 /* 'throw'.length */) {
            code.prependLeft(this.start + 5, ' ');
        }
    }
}
