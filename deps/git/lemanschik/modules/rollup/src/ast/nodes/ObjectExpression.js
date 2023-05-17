import { BLANK } from '../../utils/blank';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, UnknownKey } from '../utils/PathTracker';
import Identifier from './Identifier';
import Literal from './Literal';
import * as NodeType from './NodeType';
import SpreadElement from './SpreadElement';
import { NodeBase } from './shared/Node';
import { ObjectEntity } from './shared/ObjectEntity';
import { OBJECT_PROTOTYPE } from './shared/ObjectPrototype';
export default class ObjectExpression extends NodeBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
    }
    deoptimizeCache() {
        this.getObjectEntity().deoptimizeAllProperties();
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
    render(code, options, { renderedSurroundingElement } = BLANK) {
        super.render(code, options);
        if (renderedSurroundingElement === NodeType.ExpressionStatement ||
            renderedSurroundingElement === NodeType.ArrowFunctionExpression) {
            code.appendRight(this.start, '(');
            code.prependLeft(this.end, ')');
        }
    }
    applyDeoptimizations() { }
    getObjectEntity() {
        if (this.objectEntity !== null) {
            return this.objectEntity;
        }
        let prototype = OBJECT_PROTOTYPE;
        const properties = [];
        for (const property of this.properties) {
            if (property instanceof SpreadElement) {
                properties.push({ key: UnknownKey, kind: 'init', property });
                continue;
            }
            let key;
            if (property.computed) {
                const keyValue = property.key.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, this);
                if (typeof keyValue === 'symbol') {
                    properties.push({ key: UnknownKey, kind: property.kind, property });
                    continue;
                }
                else {
                    key = String(keyValue);
                }
            }
            else {
                key =
                    property.key instanceof Identifier
                        ? property.key.name
                        : String(property.key.value);
                if (key === '__proto__' && property.kind === 'init') {
                    prototype =
                        property.value instanceof Literal && property.value.value === null
                            ? null
                            : property.value;
                    continue;
                }
            }
            properties.push({ key, kind: property.kind, property });
        }
        return (this.objectEntity = new ObjectEntity(properties, prototype));
    }
}
