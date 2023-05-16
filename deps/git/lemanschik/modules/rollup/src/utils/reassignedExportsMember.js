export function isReassignedExportsMember(variable, exportNamesByVariable) {
    return (variable.renderBaseName !== null && exportNamesByVariable.has(variable) && variable.isReassigned);
}
