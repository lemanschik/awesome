export default function trimEmptyImports(dependencies) {
    let index = dependencies.length;
    while (index--) {
        const { imports, reexports } = dependencies[index];
        if (imports || reexports) {
            return dependencies.slice(0, index + 1);
        }
    }
    return [];
}
