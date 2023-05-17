import { BLANK } from '../../utils/blank';
import { findFirstOccurrenceOutsideComment, findNonWhiteSpace, removeLineBreaks } from '../../utils/renderHelpers';
import { removeAnnotations } from '../../utils/treeshakeNode';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, UNKNOWN_PATH } from '../utils/PathTracker';
import { UnknownValue } from './shared/Expression';
import { MultiExpression } from './shared/MultiExpression';
import { NodeBase } from './shared/Node';
export default class ConditionalExpression extends NodeBase {
    constructor() {
        super(...arguments);
        this.expressionsToBeDeoptimized = [];
        this.isBranchResolutionAnalysed = false;
        this.usedBranch = null;
    }
    deoptimizeCache() {
        if (this.usedBranch !== null) {
            const unusedBranch = this.usedBranch === this.consequent ? this.alternate : this.consequent;
            this.usedBranch = null;
            unusedBranch.deoptimizePath(UNKNOWN_PATH);
            for (const expression of this.expressionsToBeDeoptimized) {
                expression.deoptimizeCache();
            }
        }
    }
    deoptimizePath(path) {
        const usedBranch = this.getUsedBranch();
        if (!usedBranch) {
            this.consequent.deoptimizePath(path);
            this.alternate.deoptimizePath(path);
        }
        else {
            usedBranch.deoptimizePath(path);
        }
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.consequent.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
        this.alternate.deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        const usedBranch = this.getUsedBranch();
        if (!usedBranch)
            return UnknownValue;
        this.expressionsToBeDeoptimized.push(origin);
        return usedBranch.getLiteralValueAtPath(path, recursionTracker, origin);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        const usedBranch = this.getUsedBranch();
        if (!usedBranch)
            return [
                new MultiExpression([
                    this.consequent.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin)[0],
                    this.alternate.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin)[0]
                ]),
                false
            ];
        this.expressionsToBeDeoptimized.push(origin);
        return usedBranch.getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
    }
    hasEffects(context) {
        if (this.test.hasEffects(context))
            return true;
        const usedBranch = this.getUsedBranch();
        if (!usedBranch) {
            return this.consequent.hasEffects(context) || this.alternate.hasEffects(context);
        }
        return usedBranch.hasEffects(context);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        const usedBranch = this.getUsedBranch();
        if (!usedBranch) {
            return (this.consequent.hasEffectsOnInteractionAtPath(path, interaction, context) ||
                this.alternate.hasEffectsOnInteractionAtPath(path, interaction, context));
        }
        return usedBranch.hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        const usedBranch = this.getUsedBranch();
        if (includeChildrenRecursively || this.test.shouldBeIncluded(context) || usedBranch === null) {
            this.test.include(context, includeChildrenRecursively);
            this.consequent.include(context, includeChildrenRecursively);
            this.alternate.include(context, includeChildrenRecursively);
        }
        else {
            usedBranch.include(context, includeChildrenRecursively);
        }
    }
    includeCallArguments(context, parameters) {
        const usedBranch = this.getUsedBranch();
        if (!usedBranch) {
            this.consequent.includeCallArguments(context, parameters);
            this.alternate.includeCallArguments(context, parameters);
        }
        else {
            usedBranch.includeCallArguments(context, parameters);
        }
    }
    render(code, options, { isCalleeOfRenderedParent, preventASI, renderedParentType, renderedSurroundingElement } = BLANK) {
        const usedBranch = this.getUsedBranch();
        if (!this.test.included) {
            const colonPos = findFirstOccurrenceOutsideComment(code.original, ':', this.consequent.end);
            const inclusionStart = findNonWhiteSpace(code.original, (this.consequent.included
                ? findFirstOccurrenceOutsideComment(code.original, '?', this.test.end)
                : colonPos) + 1);
            if (preventASI) {
                removeLineBreaks(code, inclusionStart, usedBranch.start);
            }
            code.remove(this.start, inclusionStart);
            if (this.consequent.included) {
                code.remove(colonPos, this.end);
            }
            removeAnnotations(this, code);
            usedBranch.render(code, options, {
                isCalleeOfRenderedParent,
                preventASI: true,
                renderedParentType: renderedParentType || this.parent.type,
                renderedSurroundingElement: renderedSurroundingElement || this.parent.type
            });
        }
        else {
            this.test.render(code, options, { renderedSurroundingElement });
            this.consequent.render(code, options);
            this.alternate.render(code, options);
        }
    }
    getUsedBranch() {
        if (this.isBranchResolutionAnalysed) {
            return this.usedBranch;
        }
        this.isBranchResolutionAnalysed = true;
        const testValue = this.test.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, this);
        return typeof testValue === 'symbol'
            ? null
            : (this.usedBranch = testValue ? this.consequent : this.alternate);
    }
}
