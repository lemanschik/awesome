import { locate } from 'locate-character';
import { ANNOTATION_KEY, INVALID_COMMENT_KEY } from '../../../utils/pureComments';
import { createHasEffectsContext } from '../../ExecutionContext';
import { INTERACTION_ASSIGNED } from '../../NodeInteractions';
import { getAndCreateKeys, keys } from '../../keys';
import { EMPTY_PATH, UNKNOWN_PATH } from '../../utils/PathTracker';
import { ExpressionEntity } from './Expression';
export const INCLUDE_PARAMETERS = 'variables';
export class NodeBase extends ExpressionEntity {
    constructor(esTreeNode, parent, parentScope) {
        super();
        /**
         * Nodes can apply custom deoptimizations once they become part of the
         * executed code. To do this, they must initialize this as false, implement
         * applyDeoptimizations and call this from include and hasEffects if they have
         * custom handlers
         */
        this.deoptimized = false;
        this.esTreeNode = esTreeNode;
        this.keys = keys[esTreeNode.type] || getAndCreateKeys(esTreeNode);
        this.parent = parent;
        this.context = parent.context;
        this.createScope(parentScope);
        this.parseNode(esTreeNode);
        this.initialise();
        this.context.magicString.addSourcemapLocation(this.start);
        this.context.magicString.addSourcemapLocation(this.end);
    }
    addExportedVariables(_variables, _exportNamesByVariable) { }
    /**
     * Override this to bind assignments to variables and do any initialisations that
     * require the scopes to be populated with variables.
     */
    bind() {
        for (const key of this.keys) {
            const value = this[key];
            if (Array.isArray(value)) {
                for (const child of value) {
                    child?.bind();
                }
            }
            else if (value) {
                value.bind();
            }
        }
    }
    /**
     * Override if this node should receive a different scope than the parent scope.
     */
    createScope(parentScope) {
        this.scope = parentScope;
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        for (const key of this.keys) {
            const value = this[key];
            if (value === null)
                continue;
            if (Array.isArray(value)) {
                for (const child of value) {
                    if (child?.hasEffects(context))
                        return true;
                }
            }
            else if (value.hasEffects(context))
                return true;
        }
        return false;
    }
    hasEffectsAsAssignmentTarget(context, _checkAccess) {
        return (this.hasEffects(context) ||
            this.hasEffectsOnInteractionAtPath(EMPTY_PATH, this.assignmentInteraction, context));
    }
    include(context, includeChildrenRecursively, _options) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        this.included = true;
        for (const key of this.keys) {
            const value = this[key];
            if (value === null)
                continue;
            if (Array.isArray(value)) {
                for (const child of value) {
                    child?.include(context, includeChildrenRecursively);
                }
            }
            else {
                value.include(context, includeChildrenRecursively);
            }
        }
    }
    includeAsAssignmentTarget(context, includeChildrenRecursively, _deoptimizeAccess) {
        this.include(context, includeChildrenRecursively);
    }
    /**
     * Override to perform special initialisation steps after the scope is initialised
     */
    initialise() { }
    insertSemicolon(code) {
        if (code.original[this.end - 1] !== ';') {
            code.appendLeft(this.end, ';');
        }
    }
    parseNode(esTreeNode) {
        for (const [key, value] of Object.entries(esTreeNode)) {
            // That way, we can override this function to add custom initialisation and then call super.parseNode
            if (this.hasOwnProperty(key))
                continue;
            if (key.charCodeAt(0) === 95 /* _ */) {
                if (key === ANNOTATION_KEY) {
                    this.annotations = value;
                }
                else if (key === INVALID_COMMENT_KEY) {
                    for (const { start, end } of value)
                        this.context.magicString.remove(start, end);
                }
            }
            else if (typeof value !== 'object' || value === null) {
                this[key] = value;
            }
            else if (Array.isArray(value)) {
                this[key] = [];
                for (const child of value) {
                    this[key].push(child === null
                        ? null
                        : new (this.context.getNodeConstructor(child.type))(child, this, this.scope));
                }
            }
            else {
                this[key] = new (this.context.getNodeConstructor(value.type))(value, this, this.scope);
            }
        }
    }
    render(code, options) {
        for (const key of this.keys) {
            const value = this[key];
            if (value === null)
                continue;
            if (Array.isArray(value)) {
                for (const child of value) {
                    child?.render(code, options);
                }
            }
            else {
                value.render(code, options);
            }
        }
    }
    setAssignedValue(value) {
        this.assignmentInteraction = { args: [value], thisArg: null, type: INTERACTION_ASSIGNED };
    }
    shouldBeIncluded(context) {
        return this.included || (!context.brokenFlow && this.hasEffects(createHasEffectsContext()));
    }
    /**
     * Just deoptimize everything by default so that when e.g. we do not track
     * something properly, it is deoptimized.
     * @protected
     */
    applyDeoptimizations() {
        this.deoptimized = true;
        for (const key of this.keys) {
            const value = this[key];
            if (value === null)
                continue;
            if (Array.isArray(value)) {
                for (const child of value) {
                    child?.deoptimizePath(UNKNOWN_PATH);
                }
            }
            else {
                value.deoptimizePath(UNKNOWN_PATH);
            }
        }
        this.context.requestTreeshakingPass();
    }
}
export { NodeBase as StatementBase };
export function locateNode(node) {
    const location = locate(node.context.code, node.start, { offsetLine: 1 });
    location.file = node.context.fileName;
    location.toString = () => JSON.stringify(location);
    return location;
}
export function logNode(node) {
    return node.context.code.slice(node.start, node.end);
}
