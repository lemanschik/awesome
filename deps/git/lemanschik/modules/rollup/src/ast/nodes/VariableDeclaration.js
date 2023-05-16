import { BLANK } from '../../utils/blank';
import { isReassignedExportsMember } from '../../utils/reassignedExportsMember';
import { findFirstOccurrenceOutsideComment, findNonWhiteSpace, getCommaSeparatedNodesWithBoundaries } from '../../utils/renderHelpers';
import { getSystemExportStatement, renderSystemExportExpression } from '../../utils/systemJsRendering';
import { EMPTY_PATH } from '../utils/PathTracker';
import ArrayPattern from './ArrayPattern';
import Identifier from './Identifier';
import * as NodeType from './NodeType';
import ObjectPattern from './ObjectPattern';
import { NodeBase } from './shared/Node';
function areAllDeclarationsIncludedAndNotExported(declarations, exportNamesByVariable) {
    for (const declarator of declarations) {
        if (!declarator.id.included)
            return false;
        if (declarator.id.type === NodeType.Identifier) {
            if (exportNamesByVariable.has(declarator.id.variable))
                return false;
        }
        else {
            const exportedVariables = [];
            declarator.id.addExportedVariables(exportedVariables, exportNamesByVariable);
            if (exportedVariables.length > 0)
                return false;
        }
    }
    return true;
}
export default class VariableDeclaration extends NodeBase {
    deoptimizePath() {
        for (const declarator of this.declarations) {
            declarator.deoptimizePath(EMPTY_PATH);
        }
    }
    hasEffectsOnInteractionAtPath() {
        return false;
    }
    include(context, includeChildrenRecursively, { asSingleStatement } = BLANK) {
        this.included = true;
        for (const declarator of this.declarations) {
            if (includeChildrenRecursively || declarator.shouldBeIncluded(context))
                declarator.include(context, includeChildrenRecursively);
            const { id, init } = declarator;
            if (asSingleStatement) {
                id.include(context, includeChildrenRecursively);
            }
            if (init &&
                id.included &&
                !init.included &&
                (id instanceof ObjectPattern || id instanceof ArrayPattern)) {
                init.include(context, includeChildrenRecursively);
            }
        }
    }
    initialise() {
        for (const declarator of this.declarations) {
            declarator.declareDeclarator(this.kind);
        }
    }
    render(code, options, nodeRenderOptions = BLANK) {
        if (areAllDeclarationsIncludedAndNotExported(this.declarations, options.exportNamesByVariable)) {
            for (const declarator of this.declarations) {
                declarator.render(code, options);
            }
            if (!nodeRenderOptions.isNoStatement &&
                code.original.charCodeAt(this.end - 1) !== 59 /*";"*/) {
                code.appendLeft(this.end, ';');
            }
        }
        else {
            this.renderReplacedDeclarations(code, options);
        }
    }
    applyDeoptimizations() { }
    renderDeclarationEnd(code, separatorString, lastSeparatorPos, actualContentEnd, renderedContentEnd, systemPatternExports, options) {
        if (code.original.charCodeAt(this.end - 1) === 59 /*";"*/) {
            code.remove(this.end - 1, this.end);
        }
        separatorString += ';';
        if (lastSeparatorPos !== null) {
            if (code.original.charCodeAt(actualContentEnd - 1) === 10 /*"\n"*/ &&
                (code.original.charCodeAt(this.end) === 10 /*"\n"*/ ||
                    code.original.charCodeAt(this.end) === 13) /*"\r"*/) {
                actualContentEnd--;
                if (code.original.charCodeAt(actualContentEnd) === 13 /*"\r"*/) {
                    actualContentEnd--;
                }
            }
            if (actualContentEnd === lastSeparatorPos + 1) {
                code.overwrite(lastSeparatorPos, renderedContentEnd, separatorString);
            }
            else {
                code.overwrite(lastSeparatorPos, lastSeparatorPos + 1, separatorString);
                code.remove(actualContentEnd, renderedContentEnd);
            }
        }
        else {
            code.appendLeft(renderedContentEnd, separatorString);
        }
        if (systemPatternExports.length > 0) {
            code.appendLeft(renderedContentEnd, ` ${getSystemExportStatement(systemPatternExports, options)};`);
        }
    }
    renderReplacedDeclarations(code, options) {
        const separatedNodes = getCommaSeparatedNodesWithBoundaries(this.declarations, code, this.start + this.kind.length, this.end - (code.original.charCodeAt(this.end - 1) === 59 /*";"*/ ? 1 : 0));
        let actualContentEnd, renderedContentEnd;
        renderedContentEnd = findNonWhiteSpace(code.original, this.start + this.kind.length);
        let lastSeparatorPos = renderedContentEnd - 1;
        code.remove(this.start, lastSeparatorPos);
        let isInDeclaration = false;
        let hasRenderedContent = false;
        let separatorString = '', leadingString, nextSeparatorString;
        const aggregatedSystemExports = [];
        const singleSystemExport = gatherSystemExportsAndGetSingleExport(separatedNodes, options, aggregatedSystemExports);
        for (const { node, start, separator, contentEnd, end } of separatedNodes) {
            if (!node.included) {
                code.remove(start, end);
                continue;
            }
            node.render(code, options);
            leadingString = '';
            nextSeparatorString = '';
            if (!node.id.included ||
                (node.id instanceof Identifier &&
                    isReassignedExportsMember(node.id.variable, options.exportNamesByVariable))) {
                if (hasRenderedContent) {
                    separatorString += ';';
                }
                isInDeclaration = false;
            }
            else {
                if (singleSystemExport && singleSystemExport === node.id.variable) {
                    const operatorPos = findFirstOccurrenceOutsideComment(code.original, '=', node.id.end);
                    renderSystemExportExpression(singleSystemExport, findNonWhiteSpace(code.original, operatorPos + 1), separator === null ? contentEnd : separator, code, options);
                }
                if (isInDeclaration) {
                    separatorString += ',';
                }
                else {
                    if (hasRenderedContent) {
                        separatorString += ';';
                    }
                    leadingString += `${this.kind} `;
                    isInDeclaration = true;
                }
            }
            if (renderedContentEnd === lastSeparatorPos + 1) {
                code.overwrite(lastSeparatorPos, renderedContentEnd, separatorString + leadingString);
            }
            else {
                code.overwrite(lastSeparatorPos, lastSeparatorPos + 1, separatorString);
                code.appendLeft(renderedContentEnd, leadingString);
            }
            actualContentEnd = contentEnd;
            renderedContentEnd = end;
            hasRenderedContent = true;
            lastSeparatorPos = separator;
            separatorString = nextSeparatorString;
        }
        this.renderDeclarationEnd(code, separatorString, lastSeparatorPos, actualContentEnd, renderedContentEnd, aggregatedSystemExports, options);
    }
}
function gatherSystemExportsAndGetSingleExport(separatedNodes, options, aggregatedSystemExports) {
    let singleSystemExport = null;
    if (options.format === 'system') {
        for (const { node } of separatedNodes) {
            if (node.id instanceof Identifier &&
                node.init &&
                aggregatedSystemExports.length === 0 &&
                options.exportNamesByVariable.get(node.id.variable)?.length === 1) {
                singleSystemExport = node.id.variable;
                aggregatedSystemExports.push(singleSystemExport);
            }
            else {
                node.id.addExportedVariables(aggregatedSystemExports, options.exportNamesByVariable);
            }
        }
        if (aggregatedSystemExports.length > 1) {
            singleSystemExport = null;
        }
        else if (singleSystemExport) {
            aggregatedSystemExports.length = 0;
        }
    }
    return singleSystemExport;
}
