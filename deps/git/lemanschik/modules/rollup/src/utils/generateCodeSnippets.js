import RESERVED_NAMES from './RESERVED_NAMES';
export function getGenerateCodeSnippets({ compact, generatedCode: { arrowFunctions, constBindings, objectShorthand, reservedNamesAsProps } }) {
    const { _, n, s } = compact ? { _: '', n: '', s: '' } : { _: ' ', n: '\n', s: ';' };
    const cnst = constBindings ? 'const' : 'var';
    const getNonArrowFunctionIntro = (parameters, { isAsync, name }) => `${isAsync ? `async ` : ''}function${name ? ` ${name}` : ''}${_}(${parameters.join(`,${_}`)})${_}`;
    const getFunctionIntro = arrowFunctions
        ? (parameters, { isAsync, name }) => {
            const singleParameter = parameters.length === 1;
            const asyncString = isAsync ? `async${singleParameter ? ' ' : _}` : '';
            return `${name ? `${cnst} ${name}${_}=${_}` : ''}${asyncString}${singleParameter ? parameters[0] : `(${parameters.join(`,${_}`)})`}${_}=>${_}`;
        }
        : getNonArrowFunctionIntro;
    const getDirectReturnFunction = (parameters, { functionReturn, lineBreakIndent, name }) => [
        `${getFunctionIntro(parameters, {
            isAsync: false,
            name
        })}${arrowFunctions
            ? lineBreakIndent
                ? `${n}${lineBreakIndent.base}${lineBreakIndent.t}`
                : ''
            : `{${lineBreakIndent ? `${n}${lineBreakIndent.base}${lineBreakIndent.t}` : _}${functionReturn ? 'return ' : ''}`}`,
        arrowFunctions
            ? `${name ? ';' : ''}${lineBreakIndent ? `${n}${lineBreakIndent.base}` : ''}`
            : `${s}${lineBreakIndent ? `${n}${lineBreakIndent.base}` : _}}`
    ];
    const isValidPropertyName = reservedNamesAsProps
        ? (name) => validPropertyName.test(name)
        : (name) => !RESERVED_NAMES.has(name) && validPropertyName.test(name);
    return {
        _,
        cnst,
        getDirectReturnFunction,
        getDirectReturnIifeLeft: (parameters, returned, { needsArrowReturnParens, needsWrappedFunction }) => {
            const [left, right] = getDirectReturnFunction(parameters, {
                functionReturn: true,
                lineBreakIndent: null,
                name: null
            });
            return `${wrapIfNeeded(`${left}${wrapIfNeeded(returned, arrowFunctions && needsArrowReturnParens)}${right}`, arrowFunctions || needsWrappedFunction)}(`;
        },
        getFunctionIntro,
        getNonArrowFunctionIntro,
        getObject(fields, { lineBreakIndent }) {
            const prefix = lineBreakIndent ? `${n}${lineBreakIndent.base}${lineBreakIndent.t}` : _;
            return `{${fields
                .map(([key, value]) => {
                if (key === null)
                    return `${prefix}${value}`;
                const needsQuotes = !isValidPropertyName(key);
                return key === value && objectShorthand && !needsQuotes
                    ? prefix + key
                    : `${prefix}${needsQuotes ? `'${key}'` : key}:${_}${value}`;
            })
                .join(`,`)}${fields.length === 0 ? '' : lineBreakIndent ? `${n}${lineBreakIndent.base}` : _}}`;
        },
        getPropertyAccess: (name) => isValidPropertyName(name) ? `.${name}` : `[${JSON.stringify(name)}]`,
        n,
        s
    };
}
const wrapIfNeeded = (code, needsParens) => needsParens ? `(${code})` : code;
const validPropertyName = /^(?!\d)[\w$]+$/;
