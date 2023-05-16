import { findFirstOccurrenceOutsideComment, findNonWhiteSpace } from '../../utils/renderHelpers';
import { StatementBase } from './shared/Node';
export default class LabeledStatement extends StatementBase {
    hasEffects(context) {
        const brokenFlow = context.brokenFlow;
        context.ignore.labels.add(this.label.name);
        if (this.body.hasEffects(context))
            return true;
        context.ignore.labels.delete(this.label.name);
        if (context.includedLabels.has(this.label.name)) {
            context.includedLabels.delete(this.label.name);
            context.brokenFlow = brokenFlow;
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        const brokenFlow = context.brokenFlow;
        this.body.include(context, includeChildrenRecursively);
        if (includeChildrenRecursively || context.includedLabels.has(this.label.name)) {
            this.label.include();
            context.includedLabels.delete(this.label.name);
            context.brokenFlow = brokenFlow;
        }
    }
    render(code, options) {
        if (this.label.included) {
            this.label.render(code, options);
        }
        else {
            code.remove(this.start, findNonWhiteSpace(code.original, findFirstOccurrenceOutsideComment(code.original, ':', this.label.end) + 1));
        }
        this.body.render(code, options);
    }
}
