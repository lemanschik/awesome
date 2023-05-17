import { errorModuleLevelDirective } from '../../utils/error';
import * as NodeType from './NodeType';
import { StatementBase } from './shared/Node';
export default class ExpressionStatement extends StatementBase {
    initialise() {
        if (this.directive &&
            this.directive !== 'use strict' &&
            this.parent.type === NodeType.Program) {
            this.context.warn(
            // This is necessary, because either way (deleting or not) can lead to errors.
            errorModuleLevelDirective(this.directive, this.context.module.id), this.start);
        }
    }
    render(code, options) {
        super.render(code, options);
        if (this.included)
            this.insertSemicolon(code);
    }
    shouldBeIncluded(context) {
        if (this.directive && this.directive !== 'use strict')
            return this.parent.type !== NodeType.Program;
        return super.shouldBeIncluded(context);
    }
    applyDeoptimizations() { }
}
