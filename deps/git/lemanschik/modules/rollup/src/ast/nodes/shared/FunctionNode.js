import { INTERACTION_CALLED } from '../../NodeInteractions';
import FunctionScope from '../../scopes/FunctionScope';
import Identifier from '../Identifier';
import { UNKNOWN_EXPRESSION } from './Expression';
import FunctionBase from './FunctionBase';
import { ObjectEntity } from './ObjectEntity';
import { OBJECT_PROTOTYPE } from './ObjectPrototype';
export default class FunctionNode extends FunctionBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
    }
    createScope(parentScope) {
        this.scope = new FunctionScope(parentScope, this.context);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        super.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
        if (interaction.type === INTERACTION_CALLED && path.length === 0) {
            this.scope.thisVariable.addEntityToBeDeoptimized(interaction.thisArg);
        }
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return !!this.id?.hasEffects(context);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (super.hasEffectsOnInteractionAtPath(path, interaction, context))
            return true;
        if (interaction.type === INTERACTION_CALLED) {
            const thisInit = context.replacedVariableInits.get(this.scope.thisVariable);
            context.replacedVariableInits.set(this.scope.thisVariable, interaction.withNew
                ? new ObjectEntity(Object.create(null), OBJECT_PROTOTYPE)
                : UNKNOWN_EXPRESSION);
            const { brokenFlow, ignore, replacedVariableInits } = context;
            context.ignore = {
                breaks: false,
                continues: false,
                labels: new Set(),
                returnYield: true
            };
            if (this.body.hasEffects(context))
                return true;
            context.brokenFlow = brokenFlow;
            if (thisInit) {
                replacedVariableInits.set(this.scope.thisVariable, thisInit);
            }
            else {
                replacedVariableInits.delete(this.scope.thisVariable);
            }
            context.ignore = ignore;
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        super.include(context, includeChildrenRecursively);
        this.id?.include();
        const hasArguments = this.scope.argumentsVariable.included;
        for (const parameter of this.params) {
            if (!(parameter instanceof Identifier) || hasArguments) {
                parameter.include(context, includeChildrenRecursively);
            }
        }
    }
    initialise() {
        super.initialise();
        this.id?.declare('function', this);
    }
    getObjectEntity() {
        if (this.objectEntity !== null) {
            return this.objectEntity;
        }
        return (this.objectEntity = new ObjectEntity([
            {
                key: 'prototype',
                kind: 'init',
                property: new ObjectEntity([], OBJECT_PROTOTYPE)
            }
        ], OBJECT_PROTOTYPE));
    }
}
