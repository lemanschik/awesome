import { renderStatementList } from '../../utils/renderHelpers';
import { NodeBase } from './shared/Node';
export default class Program extends NodeBase {
    constructor() {
        super(...arguments);
        this.hasCachedEffect = false;
    }
    hasEffects(context) {
        // We are caching here to later more efficiently identify side-effect-free modules
        if (this.hasCachedEffect)
            return true;
        for (const node of this.body) {
            if (node.hasEffects(context)) {
                return (this.hasCachedEffect = true);
            }
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        for (const node of this.body) {
            if (includeChildrenRecursively || node.shouldBeIncluded(context)) {
                node.include(context, includeChildrenRecursively);
            }
        }
    }
    render(code, options) {
        let start = this.start;
        if (code.original.startsWith('#!')) {
            start = Math.min(code.original.indexOf('\n') + 1, this.end);
            code.remove(0, start);
        }
        if (this.body.length > 0) {
            renderStatementList(this.body, code, start, this.end, options);
        }
        else {
            super.render(code, options);
        }
    }
    applyDeoptimizations() { }
}
