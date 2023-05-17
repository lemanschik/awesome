import { NodeBase } from './shared/Node';
export default class ExportAllDeclaration extends NodeBase {
    hasEffects() {
        return false;
    }
    initialise() {
        this.context.addExport(this);
    }
    render(code, _options, nodeRenderOptions) {
        code.remove(nodeRenderOptions.start, nodeRenderOptions.end);
    }
    applyDeoptimizations() { }
}
ExportAllDeclaration.prototype.needsBoundaries = true;
