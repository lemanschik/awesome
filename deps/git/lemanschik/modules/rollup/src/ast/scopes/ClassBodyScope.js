import LocalVariable from '../variables/LocalVariable';
import ThisVariable from '../variables/ThisVariable';
import ChildScope from './ChildScope';
export default class ClassBodyScope extends ChildScope {
    constructor(parent, classNode, context) {
        super(parent);
        this.variables.set('this', (this.thisVariable = new LocalVariable('this', null, classNode, context)));
        this.instanceScope = new ChildScope(this);
        this.instanceScope.variables.set('this', new ThisVariable(context));
    }
    findLexicalBoundary() {
        return this;
    }
}
