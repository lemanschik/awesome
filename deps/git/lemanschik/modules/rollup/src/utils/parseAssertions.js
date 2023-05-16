import { EMPTY_OBJECT } from './blank';
export function getAssertionsFromImportExpression(node) {
    const assertProperty = node.arguments?.[0]?.properties.find((property) => getPropertyKey(property) === 'assert')?.value;
    if (!assertProperty) {
        return EMPTY_OBJECT;
    }
    const assertFields = assertProperty.properties
        .map(property => {
        const key = getPropertyKey(property);
        if (typeof key === 'string' &&
            typeof property.value.value === 'string') {
            return [key, property.value.value];
        }
        return null;
    })
        .filter((property) => !!property);
    if (assertFields.length > 0) {
        return Object.fromEntries(assertFields);
    }
    return EMPTY_OBJECT;
}
const getPropertyKey = (property) => {
    const key = property.key;
    return key && (key.name || key.value);
};
export function getAssertionsFromImportExportDeclaration(assertions) {
    return assertions?.length
        ? Object.fromEntries(assertions.map(assertion => [getPropertyKey(assertion), assertion.value.value]))
        : EMPTY_OBJECT;
}
export function doAssertionsDiffer(assertionA, assertionB) {
    const keysA = Object.keys(assertionA);
    return (keysA.length !== Object.keys(assertionB).length ||
        keysA.some(key => assertionA[key] !== assertionB[key]));
}
