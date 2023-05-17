import { UNDEFINED_EXPRESSION } from '../values';
import LocalVariable from '../variables/LocalVariable';
export default class Scope {
    constructor() {
        this.children = [];
        this.variables = new Map();
    }
    addDeclaration(identifier, context, init, _isHoisted) {
        const name = identifier.name;
        let variable = this.variables.get(name);
        if (variable) {
            variable.addDeclaration(identifier, init);
        }
        else {
            variable = new LocalVariable(identifier.name, identifier, init || UNDEFINED_EXPRESSION, context);
            this.variables.set(name, variable);
        }
        return variable;
    }
    contains(name) {
        return this.variables.has(name);
    }
    findVariable(_name) {
        throw new Error('Internal Error: findVariable needs to be implemented by a subclass');
    }
}
