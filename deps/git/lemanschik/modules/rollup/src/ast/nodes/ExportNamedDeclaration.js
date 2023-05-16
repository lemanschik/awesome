import { NodeBase } from './shared/Node';
export default class ExportNamedDeclaration extends NodeBase {
    bind() {
        // Do not bind specifiers
        this.declaration?.bind();
    }
    hasEffects(context) {
        return !!this.declaration?.hasEffects(context);
    }
    initialise() {
        this.context.addExport(this);
    }
    render(code, options, nodeRenderOptions) {
        const { start, end } = nodeRenderOptions;
        if (this.declaration === null) {
            code.remove(start, end);
        }
        else {
            code.remove(this.start, this.declaration.start);
            this.declaration.render(code, options, { end, start });
        }
    }
    applyDeoptimizations() { }
}
ExportNamedDeclaration.prototype.needsBoundaries = true;
