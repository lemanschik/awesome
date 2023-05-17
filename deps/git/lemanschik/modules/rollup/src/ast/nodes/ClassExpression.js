import { BLANK } from '../../utils/blank';
import * as NodeType from './NodeType';
import ClassNode from './shared/ClassNode';
export default class ClassExpression extends ClassNode {
    render(code, options, { renderedSurroundingElement } = BLANK) {
        super.render(code, options);
        if (renderedSurroundingElement === NodeType.ExpressionStatement) {
            code.appendRight(this.start, '(');
            code.prependLeft(this.end, ')');
        }
    }
}
