import { UNKNOWN_PATH } from '../../utils/PathTracker';
export const UnknownValue = Symbol('Unknown Value');
export const UnknownTruthyValue = Symbol('Unknown Truthy Value');
export class ExpressionEntity {
    constructor() {
        this.included = false;
    }
    deoptimizePath(_path) { }
    deoptimizeThisOnInteractionAtPath({ thisArg }, _path, _recursionTracker) {
        thisArg.deoptimizePath(UNKNOWN_PATH);
    }
    /**
     * If possible it returns a stringifyable literal value for this node that can be used
     * for inlining or comparing values.
     * Otherwise, it should return UnknownValue.
     */
    getLiteralValueAtPath(_path, _recursionTracker, _origin) {
        return UnknownValue;
    }
    getReturnExpressionWhenCalledAtPath(_path, _interaction, _recursionTracker, _origin) {
        return UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffectsOnInteractionAtPath(_path, _interaction, _context) {
        return true;
    }
    include(_context, _includeChildrenRecursively, _options) {
        this.included = true;
    }
    includeCallArguments(context, parameters) {
        for (const argument of parameters) {
            argument.include(context, false);
        }
    }
    shouldBeIncluded(_context) {
        return true;
    }
}
export const UNKNOWN_EXPRESSION = new (class UnknownExpression extends ExpressionEntity {
})();
export const UNKNOWN_RETURN_EXPRESSION = [
    UNKNOWN_EXPRESSION,
    false
];
