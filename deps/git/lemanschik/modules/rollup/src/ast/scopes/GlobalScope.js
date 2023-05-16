import GlobalVariable from '../variables/GlobalVariable';
import UndefinedVariable from '../variables/UndefinedVariable';
import Scope from './Scope';
export default class GlobalScope extends Scope {
    constructor() {
        super();
        this.parent = null;
        this.variables.set('undefined', new UndefinedVariable());
    }
    findVariable(name) {
        let variable = this.variables.get(name);
        if (!variable) {
            variable = new GlobalVariable(name);
            this.variables.set(name, variable);
        }
        return variable;
    }
}
