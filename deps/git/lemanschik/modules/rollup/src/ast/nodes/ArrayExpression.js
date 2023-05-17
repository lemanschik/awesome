import { UNKNOWN_PATH, UnknownInteger } from '../utils/PathTracker';
import { UNDEFINED_EXPRESSION, UNKNOWN_LITERAL_NUMBER } from '../values';
import SpreadElement from './SpreadElement';
import { ARRAY_PROTOTYPE } from './shared/ArrayPrototype';
import { NodeBase } from './shared/Node';
import { ObjectEntity } from './shared/ObjectEntity';
export default class ArrayExpression extends NodeBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
    }
    deoptimizePath(path) {
        this.getObjectEntity().deoptimizePath(path);
    }
    deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker) {
        this.getObjectEntity().deoptimizeThisOnInteractionAtPath(interaction, path, recursionTracker);
    }
    getLiteralValueAtPath(path, recursionTracker, origin) {
        return this.getObjectEntity().getLiteralValueAtPath(path, recursionTracker, origin);
    }
    getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin) {
        return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(path, interaction, recursionTracker, origin);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return this.getObjectEntity().hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        let hasSpread = false;
        for (let index = 0; index < this.elements.length; index++) {
            const element = this.elements[index];
            if (element && (hasSpread || element instanceof SpreadElement)) {
                hasSpread = true;
                element.deoptimizePath(UNKNOWN_PATH);
            }
        }
        this.context.requestTreeshakingPass();
    }
    getObjectEntity() {
        if (this.objectEntity !== null) {
            return this.objectEntity;
        }
        const properties = [
            { key: 'length', kind: 'init', property: UNKNOWN_LITERAL_NUMBER }
        ];
        let hasSpread = false;
        for (let index = 0; index < this.elements.length; index++) {
            const element = this.elements[index];
            if (hasSpread || element instanceof SpreadElement) {
                if (element) {
                    hasSpread = true;
                    properties.unshift({ key: UnknownInteger, kind: 'init', property: element });
                }
            }
            else if (!element) {
                properties.push({ key: String(index), kind: 'init', property: UNDEFINED_EXPRESSION });
            }
            else {
                properties.push({ key: String(index), kind: 'init', property: element });
            }
        }
        return (this.objectEntity = new ObjectEntity(properties, ARRAY_PROTOTYPE));
    }
}
