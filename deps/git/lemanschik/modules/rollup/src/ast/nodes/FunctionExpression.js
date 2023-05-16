import { BLANK } from '../../utils/blank';
import * as NodeType from './NodeType';
import FunctionNode from './shared/FunctionNode';
export default class FunctionExpression extends FunctionNode {
    render(code, options, { renderedSurroundingElement } = BLANK) {
        super.render(code, options);
        if (renderedSurroundingElement === NodeType.ExpressionStatement) {
            code.appendRight(this.start, '(');
            code.prependLeft(this.end, ')');
        }
    }
}
