import { INTERACTION_ACCESSED } from '../NodeInteractions';
import Variable from './Variable';
export default class ExternalVariable extends Variable {
    constructor(module, name) {
        super(name);
        this.referenced = false;
        this.module = module;
        this.isNamespace = name === '*';
    }
    addReference(identifier) {
        this.referenced = true;
        if (this.name === 'default' || this.name === '*') {
            this.module.suggestName(identifier.name);
        }
    }
    hasEffectsOnInteractionAtPath(path, { type }) {
        return type !== INTERACTION_ACCESSED || path.length > (this.isNamespace ? 1 : 0);
    }
    include() {
        if (!this.included) {
            this.included = true;
            this.module.used = true;
        }
    }
}
