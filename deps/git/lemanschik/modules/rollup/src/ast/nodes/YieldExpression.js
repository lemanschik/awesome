import { NodeBase } from './shared/Node';
export default class YieldExpression extends NodeBase {
    hasEffects(context) {
        if (!this.deoptimized)
            this.applyDeoptimizations();
        return !(context.ignore.returnYield && !this.argument?.hasEffects(context));
    }
    render(code, options) {
        if (this.argument) {
            this.argument.render(code, options, { preventASI: true });
            if (this.argument.start === this.start + 5 /* 'yield'.length */) {
                code.prependLeft(this.start + 5, ' ');
            }
        }
    }
}
