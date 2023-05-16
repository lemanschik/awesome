import { NO_SEMICOLON } from '../../utils/renderHelpers';
import BlockScope from '../scopes/BlockScope';
import { StatementBase } from './shared/Node';
export default class ForStatement extends StatementBase {
    createScope(parentScope) {
        this.scope = new BlockScope(parentScope);
    }
    hasEffects(context) {
        if (this.init?.hasEffects(context) ||
            this.test?.hasEffects(context) ||
            this.update?.hasEffects(context))
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
        this.init?.include(context, includeChildrenRecursively, { asSingleStatement: true });
        this.test?.include(context, includeChildrenRecursively);
        const { brokenFlow } = context;
        this.update?.include(context, includeChildrenRecursively);
        this.body.include(context, includeChildrenRecursively, { asSingleStatement: true });
        context.brokenFlow = brokenFlow;
    }
    render(code, options) {
        this.init?.render(code, options, NO_SEMICOLON);
        this.test?.render(code, options, NO_SEMICOLON);
        this.update?.render(code, options, NO_SEMICOLON);
        this.body.render(code, options);
    }
}
