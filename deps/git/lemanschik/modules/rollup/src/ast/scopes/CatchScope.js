import { UNDEFINED_EXPRESSION } from '../values';
import ParameterScope from './ParameterScope';
export default class CatchScope extends ParameterScope {
    addDeclaration(identifier, context, init, isHoisted) {
        const existingParameter = this.variables.get(identifier.name);
        if (existingParameter) {
            // While we still create a hoisted declaration, the initializer goes to
            // the parameter. Note that technically, the declaration now belongs to
            // two variables, which is not correct but should not cause issues.
            this.parent.addDeclaration(identifier, context, UNDEFINED_EXPRESSION, isHoisted);
            existingParameter.addDeclaration(identifier, init);
            return existingParameter;
        }
        return this.parent.addDeclaration(identifier, context, init, isHoisted);
    }
}
