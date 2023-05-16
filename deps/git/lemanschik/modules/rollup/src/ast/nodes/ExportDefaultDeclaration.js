import { findFirstOccurrenceOutsideComment, findNonWhiteSpace } from '../../utils/renderHelpers';
import { getSystemExportStatement } from '../../utils/systemJsRendering';
import { treeshakeNode } from '../../utils/treeshakeNode';
import ClassDeclaration from './ClassDeclaration';
import FunctionDeclaration from './FunctionDeclaration';
import * as NodeType from './NodeType';
import { NodeBase } from './shared/Node';
// The header ends at the first non-white-space after "default"
function getDeclarationStart(code, start) {
    return findNonWhiteSpace(code, findFirstOccurrenceOutsideComment(code, 'default', start) + 7);
}
function getIdInsertPosition(code, declarationKeyword, endMarker, start) {
    const declarationEnd = findFirstOccurrenceOutsideComment(code, declarationKeyword, start) + declarationKeyword.length;
    code = code.slice(declarationEnd, findFirstOccurrenceOutsideComment(code, endMarker, declarationEnd));
    const generatorStarPos = findFirstOccurrenceOutsideComment(code, '*');
    if (generatorStarPos === -1) {
        return declarationEnd;
    }
    return declarationEnd + generatorStarPos + 1;
}
export default class ExportDefaultDeclaration extends NodeBase {
    include(context, includeChildrenRecursively) {
        super.include(context, includeChildrenRecursively);
        if (includeChildrenRecursively) {
            this.context.includeVariableInModule(this.variable);
        }
    }
    initialise() {
        const declaration = this.declaration;
        this.declarationName =
            (declaration.id && declaration.id.name) || this.declaration.name;
        this.variable = this.scope.addExportDefaultDeclaration(this.declarationName || this.context.getModuleName(), this, this.context);
        this.context.addExport(this);
    }
    render(code, options, nodeRenderOptions) {
        const { start, end } = nodeRenderOptions;
        const declarationStart = getDeclarationStart(code.original, this.start);
        if (this.declaration instanceof FunctionDeclaration) {
            this.renderNamedDeclaration(code, declarationStart, 'function', '(', this.declaration.id === null, options);
        }
        else if (this.declaration instanceof ClassDeclaration) {
            this.renderNamedDeclaration(code, declarationStart, 'class', '{', this.declaration.id === null, options);
        }
        else if (this.variable.getOriginalVariable() !== this.variable) {
            // Remove altogether to prevent re-declaring the same variable
            treeshakeNode(this, code, start, end);
            return;
        }
        else if (this.variable.included) {
            this.renderVariableDeclaration(code, declarationStart, options);
        }
        else {
            code.remove(this.start, declarationStart);
            this.declaration.render(code, options, {
                renderedSurroundingElement: NodeType.ExpressionStatement
            });
            if (code.original[this.end - 1] !== ';') {
                code.appendLeft(this.end, ';');
            }
            return;
        }
        this.declaration.render(code, options);
    }
    applyDeoptimizations() { }
    renderNamedDeclaration(code, declarationStart, declarationKeyword, endMarker, needsId, options) {
        const { exportNamesByVariable, format, snippets: { getPropertyAccess } } = options;
        const name = this.variable.getName(getPropertyAccess);
        // Remove `export default`
        code.remove(this.start, declarationStart);
        if (needsId) {
            code.appendLeft(getIdInsertPosition(code.original, declarationKeyword, endMarker, declarationStart), ` ${name}`);
        }
        if (format === 'system' &&
            this.declaration instanceof ClassDeclaration &&
            exportNamesByVariable.has(this.variable)) {
            code.appendLeft(this.end, ` ${getSystemExportStatement([this.variable], options)};`);
        }
    }
    renderVariableDeclaration(code, declarationStart, { format, exportNamesByVariable, snippets: { cnst, getPropertyAccess } }) {
        const hasTrailingSemicolon = code.original.charCodeAt(this.end - 1) === 59; /*";"*/
        const systemExportNames = format === 'system' && exportNamesByVariable.get(this.variable);
        if (systemExportNames) {
            code.overwrite(this.start, declarationStart, `${cnst} ${this.variable.getName(getPropertyAccess)} = exports('${systemExportNames[0]}', `);
            code.appendRight(hasTrailingSemicolon ? this.end - 1 : this.end, ')' + (hasTrailingSemicolon ? '' : ';'));
        }
        else {
            code.overwrite(this.start, declarationStart, `${cnst} ${this.variable.getName(getPropertyAccess)} = `);
            if (!hasTrailingSemicolon) {
                code.appendLeft(this.end, ';');
            }
        }
    }
}
ExportDefaultDeclaration.prototype.needsBoundaries = true;
