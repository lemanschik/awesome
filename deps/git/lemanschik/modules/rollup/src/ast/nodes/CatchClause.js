import CatchScope from '../scopes/CatchScope';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import { NodeBase } from './shared/Node';
export default class CatchClause extends NodeBase {
    createScope(parentScope) {
        this.scope = new CatchScope(parentScope, this.context);
    }
    parseNode(esTreeNode) {
        // Parameters need to be declared first as the logic is that initializers
        // of hoisted body variables are associated with parameters of the same
        // name instead of the variable
        const { param } = esTreeNode;
        if (param) {
            this.param = new (this.context.getNodeConstructor(param.type))(param, this, this.scope);
            this.param.declare('parameter', UNKNOWN_EXPRESSION);
        }
        super.parseNode(esTreeNode);
    }
}
