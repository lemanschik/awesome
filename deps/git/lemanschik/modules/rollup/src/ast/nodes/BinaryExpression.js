import { BLANK } from '../../utils/blank';
import { INTERACTION_ACCESSED } from '../NodeInteractions';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER } from '../utils/PathTracker';
import ExpressionStatement from './ExpressionStatement';
import { UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
const binaryOperators = {
    '!=': (left, right) => left != right,
    '!==': (left, right) => left !== right,
    '%': (left, right) => left % right,
    '&': (left, right) => left & right,
    '*': (left, right) => left * right,
    // At the moment, "**" will be transpiled to Math.pow
    '**': (left, right) => left ** right,
    '+': (left, right) => left + right,
    '-': (left, right) => left - right,
    '/': (left, right) => left / right,
    '<': (left, right) => left < right,
    '<<': (left, right) => left << right,
    '<=': (left, right) => left <= right,
    '==': (left, right) => left == right,
    '===': (left, right) => left === right,
    '>': (left, right) => left > right,
    '>=': (left, right) => left >= right,
    '>>': (left, right) => left >> right,
    '>>>': (left, right) => left >>> right,
    '^': (left, right) => left ^ right,
    '|': (left, right) => left | right
    // We use the fallback for cases where we return something unknown
    // in: () => UnknownValue,
    // instanceof: () => UnknownValue,
};
export default class BinaryExpression extends NodeBase {
    deoptimizeCache() { }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        if (path.length > 0)
            return UnknownValue;
        const leftValue = this.left.getLiteralValueAtPath(EMPTY_PATH, recursionTracker, origin);
        if (typeof leftValue === 'symbol')
            return UnknownValue;
        const rightValue = this.right.getLiteralValueAtPath(EMPTY_PATH, recursionTracker, origin);
        if (typeof rightValue === 'symbol')
            return UnknownValue;
        const operatorFunction = binaryOperators[this.operator];
        if (!operatorFunction)
            return UnknownValue;
        return operatorFunction(leftValue, rightValue);
    }
    hasEffects(context) {
        // support some implicit type coercion runtime errors
        if (this.operator === '+' &&
            this.parent instanceof ExpressionStatement &&
            this.left.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, this) === '') {
            return true;
        }
        return super.hasEffects(context);
    }
    hasEffectsOnInteractionAtPath(path, { type }) {
        return type !== INTERACTION_ACCESSED || path.length > 1;
    }
    render(code, options, { renderedSurroundingElement } = BLANK) {
        this.left.render(code, options, { renderedSurroundingElement });
        this.right.render(code, options);
    }
}
