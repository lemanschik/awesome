import { UnknownKey } from '../utils/PathTracker';
import { UNKNOWN_EXPRESSION } from './shared/Expression';
import MethodBase from './shared/MethodBase';
export default class Property extends MethodBase {
    constructor() {
        super(...arguments);
        this.declarationInit = null;
    }
    declare(kind, init) {
        this.declarationInit = init;
        return this.value.declare(kind, UNKNOWN_EXPRESSION);
    }
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        const propertyReadSideEffects = this.context.options.treeshake
            .propertyReadSideEffects;
        return ((this.parent.type === 'ObjectPattern' && propertyReadSideEffects === 'always') ||
            this.key.hasEffects(context) ||
            this.value.hasEffects(context));
    }
    markDeclarationReached() {
        this.value.markDeclarationReached();
    }
    render(code, options) {
        if (!this.shorthand) {
            this.key.render(code, options);
        }
        this.value.render(code, options, { isShorthandProperty: this.shorthand });
    }
    applyDeoptimizations() {
        this.deoptimized = true;
        if (this.declarationInit !== null) {
            this.declarationInit.deoptimizePath([UnknownKey, UnknownKey]);
            this.context.requestTreeshakingPass();
        }
    }
}
