import ClassBodyScope from '../scopes/ClassBodyScope';
import { NodeBase } from './shared/Node';
export default class ClassBody extends NodeBase {
    createScope(parentScope) {
        this.scope = new ClassBodyScope(parentScope, this.parent, this.context);
    }
    include(context, includeChildrenRecursively) {
        this.included = true;
        this.context.includeVariableInModule(this.scope.thisVariable);
        for (const definition of this.body) {
            definition.include(context, includeChildrenRecursively);
        }
    }
    parseNode(esTreeNode) {
        const body = (this.body = []);
        for (const definition of esTreeNode.body) {
            body.push(new (this.context.getNodeConstructor(definition.type))(definition, this, definition.static ? this.scope : this.scope.instanceScope));
        }
        super.parseNode(esTreeNode);
    }
    applyDeoptimizations() { }
}
