import { NodeBase } from './shared/Node';
export default class Super extends NodeBase {
    bind() {
        this.variable = this.scope.findVariable('this');
    }
    deoptimizePath(path) {
        this.variable.deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.variable.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    include() {
        if (!this.included) {
            this.included = true;
            this.context.includeVariableInModule(this.variable);
        }
    }
}
