import { INTERACTION_CALLED } from '../NodeInteractions';
import ReturnValueScope from '../scopes/ReturnValueScope';
import Identifier from './Identifier';
import FunctionBase from './shared/FunctionBase';
import { ObjectEntity } from './shared/ObjectEntity';
import { OBJECT_PROTOTYPE } from './shared/ObjectPrototype';
export default class ArrowFunctionExpression extends FunctionBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
    }
    createScope(parentScope) {
        this.scope = new ReturnValueScope(parentScope, this.context);
    }
    hasEffects() {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return false;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (super.hasEffectsOnInteractionAtPath(path, interaction, context))
            return true;
        if (interaction.type === INTERACTION_CALLED) {
            const { ignore, brokenFlow } = context;
            context.ignore = {
                breaks: false,
                continues: false,
                labels: new Set(),
                returnYield: true
            };
            if (this.body.hasEffects(context))
                return true;
            context.ignore = ignore;
            context.brokenFlow = brokenFlow;
        }
        return false;
    }
    include(context, includeChildrenRecursively) {
        super.include(context, includeChildrenRecursively);
        for (const parameter of this.params) {
            if (!(parameter instanceof Identifier)) {
                parameter.include(context, includeChildrenRecursively);
            }
        }
    }
    getObjectEntity() {
        if (this.objectEntity !== null) {
            return this.objectEntity;
        }
        return (this.objectEntity = new ObjectEntity([], OBJECT_PROTOTYPE));
    }
}
