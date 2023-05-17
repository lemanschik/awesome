export const PureFunctionKey = Symbol('PureFunction');
export const getPureFunctions = ({ treeshake }) => {
    const pureFunctions = Object.create(null);
    for (const functionName of treeshake ? treeshake.manualPureFunctions : []) {
        let currentFunctions = pureFunctions;
        for (const pathSegment of functionName.split('.')) {
            currentFunctions = currentFunctions[pathSegment] || (currentFunctions[pathSegment] = Object.create(null));
        }
        currentFunctions[PureFunctionKey] = true;
    }
    return pureFunctions;
};
