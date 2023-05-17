import { base as basicWalker } from 'acorn-walk';
import { BinaryExpression, CallExpression, ChainExpression, ConditionalExpression, ExpressionStatement, LogicalExpression, NewExpression, SequenceExpression } from '../ast/nodes/NodeType';
import { SOURCEMAPPING_URL_RE } from './sourceMappingURL';
export const ANNOTATION_KEY = '_rollupAnnotations';
export const INVALID_COMMENT_KEY = '_rollupRemoved';
function handlePureAnnotationsOfNode(node, state, type = node.type) {
    const { annotations, code } = state;
    // eslint-disable-next-line unicorn/consistent-destructuring
    let comment = annotations[state.annotationIndex];
    while (comment && node.start >= comment.end) {
        markPureNode(node, comment, code);
        comment = annotations[++state.annotationIndex];
    }
    if (comment && comment.end <= node.end) {
        basicWalker[type](node, state, handlePureAnnotationsOfNode);
        // eslint-disable-next-line unicorn/consistent-destructuring
        while ((comment = annotations[state.annotationIndex]) && comment.end <= node.end) {
            ++state.annotationIndex;
            annotateNode(node, comment, false);
        }
    }
}
const neitherWithespaceNorBrackets = /[^\s(]/g;
const noWhitespace = /\S/g;
function markPureNode(node, comment, code) {
    const annotatedNodes = [];
    let invalidAnnotation;
    const codeInBetween = code.slice(comment.end, node.start);
    if (doesNotMatchOutsideComment(codeInBetween, neitherWithespaceNorBrackets)) {
        const parentStart = node.start;
        while (true) {
            annotatedNodes.push(node);
            switch (node.type) {
                case ExpressionStatement:
                case ChainExpression: {
                    node = node.expression;
                    continue;
                }
                case SequenceExpression: {
                    // if there are parentheses, the annotation would apply to the entire expression
                    if (doesNotMatchOutsideComment(code.slice(parentStart, node.start), noWhitespace)) {
                        node = node.expressions[0];
                        continue;
                    }
                    invalidAnnotation = true;
                    break;
                }
                case ConditionalExpression: {
                    // if there are parentheses, the annotation would apply to the entire expression
                    if (doesNotMatchOutsideComment(code.slice(parentStart, node.start), noWhitespace)) {
                        node = node.test;
                        continue;
                    }
                    invalidAnnotation = true;
                    break;
                }
                case LogicalExpression:
                case BinaryExpression: {
                    // if there are parentheses, the annotation would apply to the entire expression
                    if (doesNotMatchOutsideComment(code.slice(parentStart, node.start), noWhitespace)) {
                        node = node.left;
                        continue;
                    }
                    invalidAnnotation = true;
                    break;
                }
                case CallExpression:
                case NewExpression: {
                    break;
                }
                default: {
                    invalidAnnotation = true;
                }
            }
            break;
        }
    }
    else {
        invalidAnnotation = true;
    }
    if (invalidAnnotation) {
        annotateNode(node, comment, false);
    }
    else {
        for (const node of annotatedNodes) {
            annotateNode(node, comment, true);
        }
    }
}
function doesNotMatchOutsideComment(code, forbiddenChars) {
    let nextMatch;
    while ((nextMatch = forbiddenChars.exec(code)) !== null) {
        if (nextMatch[0] === '/') {
            const charCodeAfterSlash = code.charCodeAt(forbiddenChars.lastIndex);
            if (charCodeAfterSlash === 42 /*"*"*/) {
                forbiddenChars.lastIndex = code.indexOf('*/', forbiddenChars.lastIndex + 1) + 2;
                continue;
            }
            else if (charCodeAfterSlash === 47 /*"/"*/) {
                forbiddenChars.lastIndex = code.indexOf('\n', forbiddenChars.lastIndex + 1) + 1;
                continue;
            }
        }
        forbiddenChars.lastIndex = 0;
        return false;
    }
    return true;
}
const pureCommentRegex = /[#@]__PURE__/;
export function addAnnotations(comments, esTreeAst, code) {
    const annotations = [];
    const sourceMappingComments = [];
    for (const comment of comments) {
        if (pureCommentRegex.test(comment.value)) {
            annotations.push(comment);
        }
        else if (SOURCEMAPPING_URL_RE.test(comment.value)) {
            sourceMappingComments.push(comment);
        }
    }
    for (const comment of sourceMappingComments) {
        annotateNode(esTreeAst, comment, false);
    }
    handlePureAnnotationsOfNode(esTreeAst, {
        annotationIndex: 0,
        annotations,
        code
    });
}
function annotateNode(node, comment, valid) {
    const key = valid ? ANNOTATION_KEY : INVALID_COMMENT_KEY;
    const property = node[key];
    if (property) {
        property.push(comment);
    }
    else {
        node[key] = [comment];
    }
}
