import { StatementBase } from './shared/Node';
export default class WhileStatement extends StatementBase {
    hasEffects(context) {
        if (this.test.hasEffects(context))
            return true;
        const { brokenFlow, ignore } = context;
        const { breaks, continues } = ignore;
        ignore.breaks = true;
        ignore.continues = true;
        if (this.body.hasEffects(context))
            return true;
        ignore.breaks = breaks;
        ignore.continues = continues;
        context.brokenFlow = brokenFlow;
        return false;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        this.test.include(context, includeChildrenRecursively);
        const { brokenFlow } = context;
        this.body.include(context, includeChildrenRecursively, { asSingleStatement: true });
        context.brokenFlow = brokenFlow;
    }
}
