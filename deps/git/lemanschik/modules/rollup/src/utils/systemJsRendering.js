export function getSystemExportStatement(exportedVariables, { exportNamesByVariable, snippets: { _, getObject, getPropertyAccess } }, modifier = '') {
    if (exportedVariables.length === 1 &&
        exportNamesByVariable.get(exportedVariables[0]).length === 1) {
        const variable = exportedVariables[0];
        return `exports('${exportNamesByVariable.get(variable)}',${_}${variable.getName(getPropertyAccess)}${modifier})`;
    }
    else {
        const fields = [];
        for (const variable of exportedVariables) {
            for (const exportName of exportNamesByVariable.get(variable)) {
                fields.push([exportName, variable.getName(getPropertyAccess) + modifier]);
            }
        }
        return `exports(${getObject(fields, { lineBreakIndent: null })})`;
    }
}
export function renderSystemExportExpression(exportedVariable, expressionStart, expressionEnd, code, { exportNamesByVariable, snippets: { _ } }) {
    code.prependRight(expressionStart, `exports('${exportNamesByVariable.get(exportedVariable)}',${_}`);
    code.appendLeft(expressionEnd, ')');
}
export function renderSystemExportFunction(exportedVariables, expressionStart, expressionEnd, needsParens, code, options) {
    const { _, getDirectReturnIifeLeft } = options.snippets;
    code.prependRight(expressionStart, getDirectReturnIifeLeft(['v'], `${getSystemExportStatement(exportedVariables, options)},${_}v`, { needsArrowReturnParens: true, needsWrappedFunction: needsParens }));
    code.appendLeft(expressionEnd, ')');
}
export function renderSystemExportSequenceAfterExpression(exportedVariable, expressionStart, expressionEnd, needsParens, code, options) {
    const { _, getPropertyAccess } = options.snippets;
    code.appendLeft(expressionEnd, `,${_}${getSystemExportStatement([exportedVariable], options)},${_}${exportedVariable.getName(getPropertyAccess)}`);
    if (needsParens) {
        code.prependRight(expressionStart, '(');
        code.appendLeft(expressionEnd, ')');
    }
}
export function renderSystemExportSequenceBeforeExpression(exportedVariable, expressionStart, expressionEnd, needsParens, code, options, modifier) {
    const { _ } = options.snippets;
    code.prependRight(expressionStart, `${getSystemExportStatement([exportedVariable], options, modifier)},${_}`);
    if (needsParens) {
        code.prependRight(expressionStart, '(');
        code.appendLeft(expressionEnd, ')');
    }
}
