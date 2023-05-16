import { NodeBase } from './shared/Node';
export default class TemplateElement extends NodeBase {
    // Do not try to bind value
    bind() { }
    hasEffects() {
        return false;
    }
    include() {
        this.included = true;
    }
    parseNode(esTreeNode) {
        this.value = esTreeNode.value;
        super.parseNode(esTreeNode);
    }
    render() { }
}
