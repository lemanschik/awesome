import { ExpressionEntity } from './Expression';
export class ObjectMember extends ExpressionEntity {
    constructor(object, key) {
        super();
        this.object = object;
        this.key = key;
    }
    deoptimizePath(path) {
        this.object.deoptimizePath([this.key, ...path]);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.object.deoptimizeThisOnInteractionAtPath(interaction, [this.key, ...path], recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.object.getLiteralValueAtPath([this.key, ...path], recursionTracker, origin);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        return this.object.getReturnExpressionWhenCalledAtPath([this.key, ...path], interaction, recursionTracker, origin);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return this.object.hasEffectsOnInteractionAtPath([this.key, ...path], interaction, context);
    }
}
