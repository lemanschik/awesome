import { createInclusionContext } from '../ExecutionContext';
import { INTERACTION_ACCESSED, INTERACTION_ASSIGNED, INTERACTION_CALLED } from '../NodeInteractions';
import * as NodeType from '../nodes/NodeType';
import { UNKNOWN_EXPRESSION, UNKNOWN_RETURN_EXPRESSION, UnknownValue } from '../nodes/shared/Expression';
import { UNKNOWN_PATH } from '../utils/PathTracker';
import Variable from './Variable';
export default class LocalVariable extends Variable {
    constructor(name, declarator, init, context) {
        super(name);
        this.calledFromTryStatement = false;
        this.additionalInitializers = null;
        this.expressionsToBeDeoptimized = [];
        this.declarations = declarator ? [declarator] : [];
        this.init = init;
        this.deoptimizationTracker = context.deoptimizationTracker;
        this.module = context.module;
    }
    addDeclaration(identifier, init) {
        this.declarations.push(identifier);
        const additionalInitializers = this.markInitializersForDeoptimization();
        if (init !== null) {
            additionalInitializers.push(init);
        }
    }
    consolidateInitializers() {
        if (this.additionalInitializers !== null) {
            for (const initializer of this.additionalInitializers) {
                initializer.deoptimizePath(UNKNOWN_PATH);
            }
            this.additionalInitializers = null;
        }
    }
    deoptimizePath(path) {
        if (this.isReassigned ||
            this.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(path, this)) {
            return;
        }
        if (path.length === 0) {
            if (!this.isReassigned) {
                this.isReassigned = true;
                const expressionsToBeDeoptimized = this.expressionsToBeDeoptimized;
                this.expressionsToBeDeoptimized = [];
                for (const expression of expressionsToBeDeoptimized) {
                    expression.deoptimizeCache();
                }
                this.init?.deoptimizePath(UNKNOWN_PATH);
            }
        }
        else {
            this.init?.deoptimizePath(path);
        }
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        if (this.isReassigned || !this.init) {
            return interaction.thisArg.deoptimizePath(UNKNOWN_PATH);
        }
        recursionTracker.withTrackedEntityAtPath(path, this.init, () => this.init.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker), undefined);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        if (this.isReassigned || !this.init) {
            return UnknownValue;
        }
        return recursionTracker.withTrackedEntityAtPath(path, this.init, () => {
            this.expressionsToBeDeoptimized.push(origin);
            return this.init.getLiteralValueAtPath(path, recursionTracker, origin);
        }, UnknownValue);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        if (this.isReassigned || !this.init) {
            return UNKNOWN_RETURN_EXPRESSION;
        }
        return recursionTracker.withTrackedEntityAtPath(path, this.init, () => {
            this.expressionsToBeDeoptimized.push(origin);
            return this.init.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
        }, UNKNOWN_RETURN_EXPRESSION);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        switch (interaction.type) {
            case INTERACTION_ACCESSED: {
                if (this.isReassigned)
                    return true;
                return (this.init &&
                    !context.accessed.trackEntityAtPathAndGetIfTracked(path, this) &&
                    this.init.hasEffectsOnInteractionAtPath(path, interaction, context));
            }
            case INTERACTION_ASSIGNED: {
                if (this.included)
                    return true;
                if (path.length === 0)
                    return false;
                if (this.isReassigned)
                    return true;
                return (this.init &&
                    !context.assigned.trackEntityAtPathAndGetIfTracked(path, this) &&
                    this.init.hasEffectsOnInteractionAtPath(path, interaction, context));
            }
            case INTERACTION_CALLED: {
                if (this.isReassigned)
                    return true;
                return (this.init &&
                    !(interaction.withNew ? context.instantiated : context.called).trackEntityAtPathAndGetIfTracked(path, interaction.args, this) &&
                    this.init.hasEffectsOnInteractionAtPath(path, interaction, context));
            }
        }
    }
    include() {
        if (!this.included) {
            this.included = true;
            for (const declaration of this.declarations) {
                // If node is a default export, it can save a tree-shaking run to include the full declaration now
                if (!declaration.included)
                    declaration.include(createInclusionContext(), false);
                let node = declaration.parent;
                while (!node.included) {
                    // We do not want to properly include parents in case they are part of a dead branch
                    // in which case .include() might pull in more dead code
                    node.included = true;
                    if (node.type === NodeType.Program)
                        break;
                    node = node.parent;
                }
            }
        }
    }
    includeCallArguments(context, parameters) {
        if (this.isReassigned || (this.init && context.includedCallArguments.has(this.init))) {
            for (const argument of parameters) {
                argument.include(context, false);
            }
        }
        else if (this.init) {
            context.includedCallArguments.add(this.init);
            this.init.includeCallArguments(context, parameters);
            context.includedCallArguments.delete(this.init);
        }
    }
    markCalledFromTryStatement() {
        this.calledFromTryStatement = true;
    }
    markInitializersForDeoptimization() {
        if (this.additionalInitializers === null) {
            this.additionalInitializers = this.init === null ? [] : [this.init];
            this.init = UNKNOWN_EXPRESSION;
            this.isReassigned = true;
        }
        return this.additionalInitializers;
    }
}
