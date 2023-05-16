import ChildScope from './ChildScope';
export default class BlockScope extends ChildScope {
    addDeclaration(identifier, context, init, isHoisted) {
        if (isHoisted) {
            const variable = this.parent.addDeclaration(identifier, context, init, isHoisted);
            // Necessary to make sure the init is deoptimized for conditional declarations.
            // We cannot call deoptimizePath here.
            variable.markInitializersForDeoptimization();
            return variable;
        }
        else {
            return super.addDeclaration(identifier, context, init, false);
        }
    }
}
