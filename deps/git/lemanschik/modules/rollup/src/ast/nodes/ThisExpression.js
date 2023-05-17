import { errorThisIsUndefined } from '../../utils/error';
import { INTERACTION_ACCESSED } from '../NodeInteractions';
import ModuleScope from '../scopes/ModuleScope';
import { NodeBase } from './shared/Node';
export default class ThisExpression extends NodeBase {
    bind() {
        this.variable = this.scope.findVariable('this');
    }
    deoptimizePath(path) {
        this.variable.deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        // We rewrite the parameter so that a ThisVariable can detect self-mutations
        this.variable.deoptimizeThisOnInteractionAtPath(interaction.thisArg === this ? { ...interaction, thisArg: this.variable } : interaction, path, recursionTracker);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (path.length === 0) {
            return interaction.type !== INTERACTION_ACCESSED;
        }
        return this.variable.hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    include() {
        if (!this.included) {
            this.included = true;
            this.context.includeVariableInModule(this.variable);
        }
    }
    initialise() {
        this.alias =
            this.scope.findLexicalBoundary() instanceof ModuleScope ? this.context.moduleContext : null;
        if (this.alias === 'undefined') {
            this.context.warn(errorThisIsUndefined(), this.start);
        }
    }
    render(code) {
        if (this.alias !== null) {
            code.overwrite(this.start, this.end, this.alias, {
                contentOnly: false,
                storeName: true
            });
        }
    }
}
