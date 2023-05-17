import { BLANK } from '../../utils/blank';
import { getCommaSeparatedNodesWithBoundaries, removeLineBreaks } from '../../utils/renderHelpers';
import { treeshakeNode } from '../../utils/treeshakeNode';
import ExpressionStatement from './ExpressionStatement';
import { NodeBase } from './shared/Node';
export default class SequenceExpression extends NodeBase {
    deoptimizePath(path) {
        this.expressions[this.expressions.length - 1].deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.expressions[this.expressions.length - 1].deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.expressions[this.expressions.length - 1].getLiteralValueAtPath(path, recursionTracker, origin);
    }
    hasEffects(context) {
        for (const expression of this.expressions) {
            if (expression.hasEffects(context))
                return true;
        }
        return false;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return this.expressions[this.expressions.length - 1].hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        const lastExpression = this.expressions[this.expressions.length - 1];
        for (const expression of this.expressions) {
            if (includeChildrenRecursively ||
                (expression === lastExpression && !(this.parent instanceof ExpressionStatement)) ||
                expression.shouldBeIncluded(context))
                expression.include(context, includeChildrenRecursively);
        }
    }
    render(code, options, { renderedParentType, isCalleeOfRenderedParent, preventASI } = BLANK) {
        let includedNodes = 0;
        let lastSeparatorPos = null;
        const lastNode = this.expressions[this.expressions.length - 1];
        for (const { node, separator, start, end } of getCommaSeparatedNodesWithBoundaries(this.expressions, code, this.start, this.end)) {
            if (!node.included) {
                treeshakeNode(node, code, start, end);
                continue;
            }
            includedNodes++;
            lastSeparatorPos = separator;
            if (includedNodes === 1 && preventASI) {
                removeLineBreaks(code, start, node.start);
            }
            if (includedNodes === 1) {
                const parentType = renderedParentType || this.parent.type;
                node.render(code, options, {
                    isCalleeOfRenderedParent: isCalleeOfRenderedParent && node === lastNode,
                    renderedParentType: parentType,
                    renderedSurroundingElement: parentType
                });
            }
            else {
                node.render(code, options);
            }
        }
        if (lastSeparatorPos) {
            code.remove(lastSeparatorPos, this.end);
        }
    }
}
