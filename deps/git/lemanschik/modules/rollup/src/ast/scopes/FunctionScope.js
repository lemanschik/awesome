import ArgumentsVariable from '../variables/ArgumentsVariable';
import ThisVariable from '../variables/ThisVariable';
import ReturnValueScope from './ReturnValueScope';
export default class FunctionScope extends ReturnValueScope {
    constructor(parent, context) {
        super(parent, context);
        this.variables.set('arguments', (this.argumentsVariable = new ArgumentsVariable(context)));
        this.variables.set('this', (this.thisVariable = new ThisVariable(context)));
    }
    findLexicalBoundary() {
        return this;
    }
    includeCallArguments(context, parameters) {
        super.includeCallArguments(context, parameters);
        if (this.argumentsVariable.included) {
            for (const argument of parameters) {
                if (!argument.included) {
                    argument.include(context, false);
                }
            }
        }
    }
}
