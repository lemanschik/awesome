import { INTERACTION_CALLED } from '../../NodeInteractions';
import ChildScope from '../../scopes/ChildScope';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER, UNKNOWN_PATH, UnknownKey } from '../../utils/PathTracker';
import Identifier from '../Identifier';
import MethodDefinition from '../MethodDefinition';
import { NodeBase } from './Node';
import { ObjectEntity } from './ObjectEntity';
import { ObjectMember } from './ObjectMember';
import { OBJECT_PROTOTYPE } from './ObjectPrototype';
export default class ClassNode extends NodeBase {
    constructor() {
        super(...arguments);
        this.objectEntity = null;
    }
    createScope(parentScope) {
        this.scope = new ChildScope(parentScope);
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
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        const initEffect = this.superClass?.hasEffects(context) || this.body.hasEffects(context);
        this.id?.markDeclarationReached();
        return initEffect || super.hasEffects(context);
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        return interaction.type === INTERACTION_CALLED && path.length === 0
            ? !interaction.withNew ||
                (this.classConstructor !== null
                    ? this.classConstructor.hasEffectsOnInteractionAtPath(path, interaction, context)
                    : this.superClass?.hasEffectsOnInteractionAtPath(path, interaction, context)) ||
                false
            : this.getObjectEntity().hasEffectsOnInteractionAtPath(path, interaction, context);
    }
    include(context, includeChildrenRecursively) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        this.included = true;
        this.superClass?.include(context, includeChildrenRecursively);
        this.body.include(context, includeChildrenRecursively);
        if (this.id) {
            this.id.markDeclarationReached();
            this.id.include();
        }
    }
    initialise() {
        this.id?.declare('class', this);
        for (const method of this.body.body) {
            if (method instanceof MethodDefinition && method.kind === 'constructor') {
                this.classConstructor = method;
                return;
            }
        }
        this.classConstructor = null;
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        for (const definition of this.body.body) {
            if (!(definition.static ||
                (definition instanceof MethodDefinition && definition.kind === 'constructor'))) {
                // Calls to methods are not tracked, ensure that the return value is deoptimized
                definition.deoptimizePath(UNKNOWN_PATH);
            }
        }
        this.context.requestTreeshakingPass();
    }
    getObjectEntity() {
        if (this.objectEntity !== null) {
            return this.objectEntity;
        }
        const staticProperties = [];
        const dynamicMethods = [];
        for (const definition of this.body.body) {
            const properties = definition.static ? staticProperties : dynamicMethods;
            const definitionKind = definition.kind;
            // Note that class fields do not end up on the prototype
            if (properties === dynamicMethods && !definitionKind)
                continue;
            const kind = definitionKind === 'set' || definitionKind === 'get' ? definitionKind : 'init';
            let key;
            if (definition.computed) {
                const keyValue = definition.key.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, this);
                if (typeof keyValue === 'symbol') {
                    properties.push({ key: UnknownKey, kind, property: definition });
                    continue;
                }
                else {
                    key = String(keyValue);
                }
            }
            else {
                key =
                    definition.key instanceof Identifier
                        ? definition.key.name
                        : String(definition.key.value);
            }
            properties.push({ key, kind, property: definition });
        }
        staticProperties.unshift({
            key: 'prototype',
            kind: 'init',
            property: new ObjectEntity(dynamicMethods, this.superClass ? new ObjectMember(this.superClass, 'prototype') : OBJECT_PROTOTYPE)
        });
        return (this.objectEntity = new ObjectEntity(staticProperties, this.superClass || OBJECT_PROTOTYPE));
    }
}
