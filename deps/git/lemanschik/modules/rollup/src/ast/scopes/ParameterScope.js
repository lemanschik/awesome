import SpreadElement from '../nodes/SpreadElement';
import { UNKNOWN_EXPRESSION } from '../nodes/shared/Expression';
import LocalVariable from '../variables/LocalVariable';
import ChildScope from './ChildScope';
export default class ParameterScope extends ChildScope {
    constructor(parent, context) {
        super(parent);
        this.parameters = [];
        this.hasRest = false;
        this.context = context;
        this.hoistedBodyVarScope = new ChildScope(this);
    }
    /**
     * Adds a parameter to this scope. Parameters must be added in the correct
     * order, e.g. from left to right.
     */
    addParameterDeclaration(identifier) {
        const name = identifier.name;
        let variable = this.hoistedBodyVarScope.variables.get(name);
        if (variable) {
            variable.addDeclaration(identifier, null);
        }
        else {
            variable = new LocalVariable(name, identifier, UNKNOWN_EXPRESSION, this.context);
        }
        this.variables.set(name, variable);
        return variable;
    }
    addParameterVariables(parameters, hasRest) {
        this.parameters = parameters;
        for (const parameterList of parameters) {
            for (const parameter of parameterList) {
                parameter.alwaysRendered = true;
            }
        }
        this.hasRest = hasRest;
    }
    includeCallArguments(context, parameters) {
        let calledFromTryStatement = false;
        let argumentIncluded = false;
        const restParameter = this.hasRest && this.parameters[this.parameters.length - 1];
        for (const checkedArgument of parameters) {
            if (checkedArgument instanceof SpreadElement) {
                for (const argument of parameters) {
                    argument.include(context, false);
                }
                break;
            }
        }
        for (let index = parameters.length - 1; index >= 0; index--) {
            const parameterVariables = this.parameters[index] || restParameter;
            const argument = parameters[index];
            if (parameterVariables) {
                calledFromTryStatement = false;
                if (parameterVariables.length === 0) {
                    // handle empty destructuring
                    argumentIncluded = true;
                }
                else {
                    for (const variable of parameterVariables) {
                        if (variable.included) {
                            argumentIncluded = true;
                        }
                        if (variable.calledFromTryStatement) {
                            calledFromTryStatement = true;
                        }
                    }
                }
            }
            if (!argumentIncluded && argument.shouldBeIncluded(context)) {
                argumentIncluded = true;
            }
            if (argumentIncluded) {
                argument.include(context, calledFromTryStatement);
            }
        }
    }
}
