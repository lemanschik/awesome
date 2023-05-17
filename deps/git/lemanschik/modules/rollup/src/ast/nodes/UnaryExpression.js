import { INTERACTION_ACCESSED, NODE_INTERACTION_UNKNOWN_ASSIGNMENT } from '../NodeInteractions';
import { EMPTY_PATH } from '../utils/PathTracker';
import Identifier from './Identifier';
import { UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
const unaryOperators = {
    '!': value => !value,
    '+': value => +value,
    '-': value => -value,
    delete: () => UnknownValue,
    typeof: value => typeof value,
    void: () => undefined,
    '~': value => ~value
};
export default class UnaryExpression extends NodeBase {
    getLiteralValueAtPath(path, recursionTracker, origin) {
        if (path.length > 0)
            return UnknownValue;
        const argumentValue = this.argument.getLiteralValueAtPath(EMPTY_PATH, recursionTracker, origin);
        if (typeof argumentValue === 'symbol')
            return UnknownValue;
        return unaryOperators[this.operator](argumentValue);
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        if (this.operator === 'typeof' && this.argument instanceof Identifier)
            return false;
        return (this.argument.hasEffects(context) ||
            (this.operator === 'delete' &&
                this.argument.hasEffectsOnInteractionAtPath(EMPTY_PATH, NODE_INTERACTION_UNKNOWN_ASSIGNMENT, context)));
    }
    hasEffectsOnInteractionAtPath(path, { type }) {
        return type !== INTERACTION_ACCESSED || path.length > (this.operator === 'void' ? 0 : 1);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        if (this.operator === 'delete') {
            this.argument.deoptimizePath(EMPTY_PATH);
            this.context.requestTreeshakingPass();
        }
    }
}
