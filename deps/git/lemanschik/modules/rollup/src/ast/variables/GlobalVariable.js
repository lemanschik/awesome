import { INTERACTION_ACCESSED, INTERACTION_ASSIGNED, INTERACTION_CALLED } from '../NodeInteractions';
import { UnknownValue } from '../nodes/shared/Expression';
import { getGlobalAtPath } from '../nodes/shared/knownGlobals';
import Variable from './Variable';
export default class GlobalVariable extends Variable {
    constructor() {
        super(...arguments);
        // Ensure we use live-bindings for globals as we do not know if they have
        // been reassigned
        this.isReassigned = true;
    }
    getLiteralValueAtPath(path, _recursionTracker, _origin) {
        const globalAtPath = getGlobalAtPath([this.name, ...path]);
        return globalAtPath ? globalAtPath.getLiteralValue() : UnknownValue;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        switch (interaction.type) {
            case INTERACTION_ACCESSED: {
                if (path.length === 0) {
                    // Technically, "undefined" is a global variable of sorts
                    return this.name !== 'undefined' && !getGlobalAtPath([this.name]);
                }
                return !getGlobalAtPath([this.name, ...path].slice(0, -1));
            }
            case INTERACTION_ASSIGNED: {
                return true;
            }
            case INTERACTION_CALLED: {
                const globalAtPath = getGlobalAtPath([this.name, ...path]);
                return !globalAtPath || globalAtPath.hasEffectsWhenCalled(interaction, context);
            }
        }
    }
}
