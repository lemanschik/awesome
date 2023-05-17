import { renderStatementList } from '../../utils/renderHelpers';
import BlockScope from '../scopes/BlockScope';
import { StatementBase } from './shared/Node';
export default class StaticBlock extends StatementBase {
    createScope(parentScope) {
        this.scope = new BlockScope(parentScope);
    }
    hasEffects(context) {
        for (const node of this.body) {
            if (node.hasEffects(context))
                return true;
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        for (const node of this.body) {
            if (includeChildrenRecursively || node.shouldBeIncluded(context))
                node.include(context, includeChildrenRecursively);
        }
    }
    render(code, options) {
        if (this.body.length > 0) {
            renderStatementList(this.body, code, this.start + 1, this.end - 1, options);
        }
        else {
            super.render(code, options);
        }
    }
}
