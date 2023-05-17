import BlockScope from './BlockScope';
export default class TrackingScope extends BlockScope {
    constructor() {
        super(...arguments);
        this.hoistedDeclarations = [];
    }
    addDeclaration(identifier, context, init, isHoisted) {
        this.hoistedDeclarations.push(identifier);
        return super.addDeclaration(identifier, context, init, isHoisted);
    }
}
