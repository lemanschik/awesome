import { UNKNOWN_EXPRESSION } from '../nodes/shared/Expression';
import { DiscriminatedPathTracker, SHARED_RECURSION_TRACKER } from '../utils/PathTracker';
import LocalVariable from './LocalVariable';
export default class ThisVariable extends LocalVariable {
    constructor(context) {
        super('this', null, null, context);
        this.deoptimizedPaths = [];
        this.entitiesToBeDeoptimized = new Set();
        this.thisDeoptimizationList = [];
        this.thisDeoptimizations = new DiscriminatedPathTracker();
    }
    addEntityToBeDeoptimized(entity) {
        for (const path of this.deoptimizedPaths) {
            entity.deoptimizePath(path);
        }
        for (const { interaction, path } of this.thisDeoptimizationList) {
            entity.deoptimizeThisOnInteractionAtPath(interaction, path, SHARED_RECURSION_TRACKER);
        }
        this.entitiesToBeDeoptimized.add(entity);
    }
    deoptimizePath(path) {
        if (path.length === 0 ||
            this.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(path, this)) {
            return;
        }
        this.deoptimizedPaths.push(path);
        for (const entity of this.entitiesToBeDeoptimized) {
            entity.deoptimizePath(path);
        }
    }
    deoptimizeThisOnInteractionAtPath(interaction, path) {
        const thisDeoptimization = {
            interaction,
            path
        };
        if (!this.thisDeoptimizations.trackEntityAtPathAndGetIfTracked(path, interaction.type, interaction.thisArg)) {
            for (const entity of this.entitiesToBeDeoptimized) {
                entity.deoptimizeThisOnInteractionAtPath(interaction, path, SHARED_RECURSION_TRACKER);
            }
            this.thisDeoptimizationList.push(thisDeoptimization);
        }
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return (this.getInit(context).hasEffectsOnInteractionAtPath(path, interaction, context) ||
            super.hasEffectsOnInteractionAtPath(path, interaction, context));
    }
    getInit(context) {
        return context.replacedVariableInits.get(this) || UNKNOWN_EXPRESSION;
    }
}
