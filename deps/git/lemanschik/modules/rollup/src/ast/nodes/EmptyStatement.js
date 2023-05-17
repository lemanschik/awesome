import { StatementBase } from './shared/Node';
export default class EmptyStatement extends StatementBase {
    hasEffects() {
        return false;
    }
}
