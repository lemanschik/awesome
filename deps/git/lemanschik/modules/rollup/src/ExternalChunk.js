import { escapeId } from './utils/escapeId';
import { normalize, relative } from './utils/path';
import { getImportPath } from './utils/relativeId';
export default class ExternalChunk {
    constructor(module, options, inputBase) {
        this.options = options;
        this.inputBase = inputBase;
        this.defaultVariableName = '';
        this.namespaceVariableName = '';
        this.variableName = '';
        this.fileName = null;
        this.importAssertions = null;
        this.id = module.id;
        this.moduleInfo = module.info;
        this.renormalizeRenderPath = module.renormalizeRenderPath;
        this.suggestedVariableName = module.suggestedVariableName;
    }
    getFileName() {
        if (this.fileName) {
            return this.fileName;
        }
        const { paths } = this.options;
        return (this.fileName =
            (typeof paths === 'function' ? paths(this.id) : paths[this.id]) ||
                (this.renormalizeRenderPath ? normalize(relative(this.inputBase, this.id)) : this.id));
    }
    getImportAssertions(snippets) {
        return (this.importAssertions || (this.importAssertions = formatAssertions(this.options.format === 'es' &&
            this.options.externalImportAssertions &&
            this.moduleInfo.assertions, snippets)));
    }
    getImportPath(importer) {
        return escapeId(this.renormalizeRenderPath
            ? getImportPath(importer, this.getFileName(), this.options.format === 'amd', false)
            : this.getFileName());
    }
}
function formatAssertions(assertions, { getObject }) {
    if (!assertions) {
        return null;
    }
    const assertionEntries = Object.entries(assertions).map(([key, value]) => [key, `'${value}'`]);
    if (assertionEntries.length > 0) {
        return getObject(assertionEntries, { lineBreakIndent: null });
    }
    return null;
}
