import { getSystemExportStatement } from '../../utils/systemJsRendering';
import Identifier from './Identifier';
import ClassNode from './shared/ClassNode';
export default class ClassDeclaration extends ClassNode {
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
    render(code, options) {
        const { exportNamesByVariable, format, snippets: { _, getPropertyAccess } } = options;
        if (this.id) {
            const { variable, name } = this.id;
            if (format === 'system' && exportNamesByVariable.has(variable)) {
                code.appendLeft(this.end, `${_}${getSystemExportStatement([variable], options)};`);
            }
            const renderedVariable = variable.getName(getPropertyAccess);
            if (renderedVariable !== name) {
                this.superClass?.render(code, options);
                this.body.render(code, options);
                code.prependRight(this.start, `let ${renderedVariable}${_}=${_}`);
                code.prependLeft(this.end, ';');
                return;
            }
        }
        super.render(code, options);
    }
    applyDeoptimizations() {
        super.applyDeoptimizations();
        const { id, scope } = this;
        if (id) {
            const { name, variable } = id;
            for (const accessedVariable of scope.accessedOutsideVariables.values()) {
                if (accessedVariable !== variable) {
                    accessedVariable.forbidName(name);
                }
            }
        }
    }
}
