import { INTERACTION_ACCESSED, INTERACTION_CALLED } from '../NodeInteractions';
import { getMemberReturnExpressionWhenCalled, hasMemberEffectWhenCalled, literalStringMembers } from '../values';
import { UNKNOWN_RETURN_EXPRESSION, UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class TemplateLiteral extends NodeBase {
    deoptimizeThisOnInteractionAtPath() { }
    getLiteralValueAtPath(path) {
        if (path.length > 0 || this.quasis.length !== 1) {
            return UnknownValue;
        }
        return this.quasis[0].value.cooked;
    }
    getReturnExpressionWhenCalledAtPath(path) {
        if (path.length !== 1) {
            return UNKNOWN_RETURN_EXPRESSION;
        }
        return getMemberReturnExpressionWhenCalled(literalStringMembers, path[0]);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (interaction.type === INTERACTION_ACCESSED) {
            return path.length > 1;
        }
        if (interaction.type === INTERACTION_CALLED && path.length === 1) {
            return hasMemberEffectWhenCalled(literalStringMembers, path[0], interaction, context);
        }
        return true;
    }
    render(code, options) {
        code.indentExclusionRanges.push([this.start, this.end]);
        super.render(code, options);
    }
}
