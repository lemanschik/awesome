import Identifier from './Identifier';
import FunctionNode from './shared/FunctionNode';
export default class FunctionDeclaration extends FunctionNode {
    initialise() {
        super.initialise();
        if (this.id !== null) {
            this.id.variable.isId = true;
        }
    }
    parseNode(esTreeNode) {
        if (esTreeNode.id !== null) {
            this.id = new Identifier(esTreeNode.id, this, this.scope.parent);
        }
        super.parseNode(esTreeNode);
    }
}
