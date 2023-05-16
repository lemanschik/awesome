import { MISSING_EXPORT_SHIM_VARIABLE } from '../../utils/variableNames';
import Variable from './Variable';
export default class ExportShimVariable extends Variable {
    constructor(module) {
        super(MISSING_EXPORT_SHIM_VARIABLE);
        this.module = module;
    }
    include() {
        super.include();
        this.module.needsExportShim = true;
    }
}
