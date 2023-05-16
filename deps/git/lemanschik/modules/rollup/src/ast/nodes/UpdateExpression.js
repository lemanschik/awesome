import { renderSystemExportExpression, renderSystemExportSequenceAfterExpression, renderSystemExportSequenceBeforeExpression } from '../../utils/systemJsRendering';
import { INTERACTION_ACCESSED } from '../NodeInteractions';
import { EMPTY_PATH } from '../utils/PathTracker';
import Identifier from './Identifier';
import * as NodeType from './NodeType';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class UpdateExpression extends NodeBase {
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return this.argument.hasEffectsAsAssignmentTarget(context, true);
    }
    hasEffectsOnInteractionAtPath(path, { type }) {
        return path.length > 1 || type !== INTERACTION_ACCESSED;
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        this.included = true;
        this.argument.includeAsAssignmentTarget(context, includeChildrenRecursively, true);
    }
    initialise() {
        this.argument.setAssignedValue(UNKNOWN_EXPRESSION);
    }
    render(code, options) {
        const { exportNamesByVariable, format, snippets: { _ } } = options;
        this.argument.render(code, options);
        if (format === 'system') {
            const variable = this.argument.variable;
            const exportNames = exportNamesByVariable.get(variable);
            if (exportNames) {
                if (this.prefix) {
                    if (exportNames.length === 1) {
                        renderSystemExportExpression(variable, this.start, this.end, code, options);
                    }
                    else {
                        renderSystemExportSequenceAfterExpression(variable, this.start, this.end, this.parent.type !== NodeType.ExpressionStatement, code, options);
                    }
                }
                else {
                    const operator = this.operator[0];
                    renderSystemExportSequenceBeforeExpression(variable, this.start, this.end, this.parent.type !== NodeType.ExpressionStatement, code, options, `${_}${operator}${_}1`);
                }
            }
        }
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        this.argument.deoptimizePath(EMPTY_PATH);
        if (this.argument instanceof Identifier) {
            const variable = this.scope.findVariable(this.argument.name);
            variable.isReassigned = true;
        }
        this.context.requestTreeshakingPass();
    }
}
