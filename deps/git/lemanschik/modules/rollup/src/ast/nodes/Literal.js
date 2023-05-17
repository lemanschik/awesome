import { INTERACTION_ACCESSED, INTERACTION_ASSIGNED, INTERACTION_CALLED } from '../NodeInteractions';
import { getLiteralMembersForValue, getMemberReturnExpressionWhenCalled, hasMemberEffectWhenCalled } from '../values';
import { UNKNOWN_RETURN_EXPRESSION, UnknownValue } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class Literal extends NodeBase {
    deoptimizeThisOnInteractionAtPath() { }
    getLiteralValueAtPath(path) {
        if (path.length > 0 ||
            // unknown literals can also be null but do not start with an "n"
            (this.value === null && this.context.code.charCodeAt(this.start) !== 110) ||
            typeof this.value === 'bigint' ||
            // to support shims for regular expressions
            this.context.code.charCodeAt(this.start) === 47) {
            return UnknownValue;
        }
        return this.value;
    }
    getReturnExpressionWhenCalledAtPath(path) {
        if (path.length !== 1)
            return UNKNOWN_RETURN_EXPRESSION;
        return getMemberReturnExpressionWhenCalled(this.members, path[0]);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        switch (interaction.type) {
            case INTERACTION_ACCESSED: {
                return path.length > (this.value === null ? 0 : 1);
            }
            case INTERACTION_ASSIGNED: {
                return true;
            }
            case INTERACTION_CALLED: {
                return (path.length !== 1 ||
                    hasMemberEffectWhenCalled(this.members, path[0], interaction, context));
            }
        }
    }
    initialise() {
        this.members = getLiteralMembersForValue(this.value);
    }
    parseNode(esTreeNode) {
        this.value = esTreeNode.value;
        this.regex = esTreeNode.regex;
        super.parseNode(esTreeNode);
    }
    render(code) {
        if (typeof this.value === 'string') {
            code.indentExclusionRanges.push([this.start + 1, this.end - 1]);
        }
    }
}
