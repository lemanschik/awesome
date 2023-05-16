import { INTERACTION_ACCESSED } from '../NodeInteractions';
import { ExpressionEntity } from '../nodes/shared/Expression';
export default class Variable extends ExpressionEntity {
    constructor(name) {
        super();
        this.name = name;
        this.alwaysRendered = false;
        this.forbiddenNames = null;
        this.initReached = false;
        this.isId = false;
        this.isReassigned = false;
        this.kind = null;
        this.renderBaseName = null;
        this.renderName = null;
    }
    /**
     * Binds identifiers that reference this variable to this variable.
     * Necessary to be able to change variable names.
     */
    addReference(_identifier) { }
    /**
     * Prevent this variable from being renamed to this name to avoid name
     * collisions
     */
    forbidName(name) {
        (this.forbiddenNames || (this.forbiddenNames = new Set())).add(name);
    }
    getBaseVariableName() {
        return this.renderBaseName || this.renderName || this.name;
    }
    getName(getPropertyAccess) {
        const name = this.renderName || this.name;
        return this.renderBaseName ? `${this.renderBaseName}${getPropertyAccess(name)}` : name;
    }
    hasEffectsOnInteractionAtPath(path, { type }, _context) {
        return type !== INTERACTION_ACCESSED || path.length > 0;
    }
    /**
     * Marks this variable as being part of the bundle, which is usually the case when one of
     * its identifiers becomes part of the bundle. Returns true if it has not been included
     * previously.
     * Once a variable is included, it should take care all its declarations are included.
     */
    include() {
        this.included = true;
    }
    markCalledFromTryStatement() { }
    setRenderNames(baseName, name) {
        this.renderBaseName = baseName;
        this.renderName = name;
    }
}
