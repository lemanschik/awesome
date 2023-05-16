import { NodeBase } from './shared/Node';
export default class ImportDeclaration extends NodeBase {
    // Do not bind specifiers or assertions
    bind() { }
    hasEffects() {
        return false;
    }
    initialise() {
        this.context.addImport(this);
    }
    render(code, _options, nodeRenderOptions) {
        code.remove(nodeRenderOptions.start, nodeRenderOptions.end);
    }
    applyDeoptimizations() { }
}
ImportDeclaration.prototype.needsBoundaries = true;
