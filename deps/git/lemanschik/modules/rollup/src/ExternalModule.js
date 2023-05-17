import ExternalVariable from './ast/variables/ExternalVariable';
import { EMPTY_ARRAY } from './utils/blank';
import { errorUnusedExternalImports, warnDeprecation } from './utils/error';
import { makeLegal } from './utils/identifierHelpers';
export default class ExternalModule {
    constructor(options, id, moduleSideEffects, meta, renormalizeRenderPath, assertions) {
        this.options = options;
        this.id = id;
        this.renormalizeRenderPath = renormalizeRenderPath;
        this.dynamicImporters = [];
        this.execIndex = Infinity;
        this.exportedVariables = new Map();
        this.importers = [];
        this.reexported = false;
        this.used = false;
        this.declarations = new Map();
        this.mostCommonSuggestion = 0;
        this.nameSuggestions = new Map();
        this.suggestedVariableName = makeLegal(id.split(/[/\\]/).pop());
        const { importers, dynamicImporters } = this;
        const info = (this.info = {
            assertions,
            ast: null,
            code: null,
            dynamicallyImportedIdResolutions: EMPTY_ARRAY,
            dynamicallyImportedIds: EMPTY_ARRAY,
            get dynamicImporters() {
                return dynamicImporters.sort();
            },
            hasDefaultExport: null,
            get hasModuleSideEffects() {
                warnDeprecation('Accessing ModuleInfo.hasModuleSideEffects from plugins is deprecated. Please use ModuleInfo.moduleSideEffects instead.', true, options);
                return info.moduleSideEffects;
            },
            id,
            implicitlyLoadedAfterOneOf: EMPTY_ARRAY,
            implicitlyLoadedBefore: EMPTY_ARRAY,
            importedIdResolutions: EMPTY_ARRAY,
            importedIds: EMPTY_ARRAY,
            get importers() {
                return importers.sort();
            },
            isEntry: false,
            isExternal: true,
            isIncluded: null,
            meta,
            moduleSideEffects,
            syntheticNamedExports: false
        });
        // Hide the deprecated key so that it only warns when accessed explicitly
        Object.defineProperty(this.info, 'hasModuleSideEffects', {
            enumerable: false
        });
    }
    getVariableForExportName(name) {
        const declaration = this.declarations.get(name);
        if (declaration)
            return [declaration];
        const externalVariable = new ExternalVariable(this, name);
        this.declarations.set(name, externalVariable);
        this.exportedVariables.set(externalVariable, name);
        return [externalVariable];
    }
    suggestName(name) {
        const value = (this.nameSuggestions.get(name) ?? 0) + 1;
        this.nameSuggestions.set(name, value);
        if (value > this.mostCommonSuggestion) {
            this.mostCommonSuggestion = value;
            this.suggestedVariableName = name;
        }
    }
    warnUnusedImports() {
        const unused = [...this.declarations]
            .filter(([name, declaration]) => name !== '*' && !declaration.included && !this.reexported && !declaration.referenced)
            .map(([name]) => name);
        if (unused.length === 0)
            return;
        const importersSet = new Set();
        for (const name of unused) {
            for (const importer of this.declarations.get(name).module.importers) {
                importersSet.add(importer);
            }
        }
        const importersArray = [...importersSet];
        this.options.onwarn(errorUnusedExternalImports(this.id, unused, importersArray));
    }
}
