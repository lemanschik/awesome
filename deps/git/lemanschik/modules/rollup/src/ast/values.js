import { INTERACTION_ACCESSED, INTERACTION_CALLED, NODE_INTERACTION_UNKNOWN_CALL } from './NodeInteractions';
import { ExpressionEntity, UNKNOWN_EXPRESSION, UNKNOWN_RETURN_EXPRESSION } from './nodes/shared/Expression';
import { EMPTY_PATH, SHARED_RECURSION_TRACKER } from './utils/PathTracker';
function assembleMemberDescriptions(memberDescriptions, inheritedDescriptions = null) {
    return Object.create(inheritedDescriptions, memberDescriptions);
}
export const UNDEFINED_EXPRESSION = new (class UndefinedExpression extends ExpressionEntity {
    getLiteralValueAtPath() {
        return undefined;
    }
})();
const returnsUnknown = {
    value: {
        hasEffectsWhenCalled: null,
        returns: UNKNOWN_EXPRESSION
    }
};
export const UNKNOWN_LITERAL_BOOLEAN = new (class UnknownBoolean extends ExpressionEntity {
    getReturnExpressionWhenCalledAtPath(path) {
        if (path.length === 1) {
            return getMemberReturnExpressionWhenCalled(literalBooleanMembers, path[0]);
        }
        return UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (interaction.type === INTERACTION_ACCESSED) {
            return path.length > 1;
        }
        if (interaction.type === INTERACTION_CALLED && path.length === 1) {
            return hasMemberEffectWhenCalled(literalBooleanMembers, path[0], interaction, context);
        }
        return true;
    }
})();
const returnsBoolean = {
    value: {
        hasEffectsWhenCalled: null,
        returns: UNKNOWN_LITERAL_BOOLEAN
    }
};
export const UNKNOWN_LITERAL_NUMBER = new (class UnknownNumber extends ExpressionEntity {
    getReturnExpressionWhenCalledAtPath(path) {
        if (path.length === 1) {
            return getMemberReturnExpressionWhenCalled(literalNumberMembers, path[0]);
        }
        return UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (interaction.type === INTERACTION_ACCESSED) {
            return path.length > 1;
        }
        if (interaction.type === INTERACTION_CALLED && path.length === 1) {
            return hasMemberEffectWhenCalled(literalNumberMembers, path[0], interaction, context);
        }
        return true;
    }
})();
const returnsNumber = {
    value: {
        hasEffectsWhenCalled: null,
        returns: UNKNOWN_LITERAL_NUMBER
    }
};
export const UNKNOWN_LITERAL_STRING = new (class UnknownString extends ExpressionEntity {
    getReturnExpressionWhenCalledAtPath(path) {
        if (path.length === 1) {
            return getMemberReturnExpressionWhenCalled(literalStringMembers, path[0]);
        }
        return UNKNOWN_RETURN_EXPRESSION;
    }
    hasEffectsOnInteractionAtPath(path, interaction, context) {
        if (interaction.type === INTERACTION_ACCESSED) {
            return path.length > 1;
        }
        if (interaction.type === INTERACTION_CALLED && path.length === 1) {
            return hasMemberEffectWhenCalled(literalStringMembers, path[0], interaction, context);
        }
        return true;
    }
})();
const returnsString = {
    value: {
        hasEffectsWhenCalled: null,
        returns: UNKNOWN_LITERAL_STRING
    }
};
const stringReplace = {
    value: {
        hasEffectsWhenCalled({ args }, context) {
            const argument1 = args[1];
            return (args.length < 2 ||
                (typeof argument1.getLiteralValueAtPath(EMPTY_PATH, SHARED_RECURSION_TRACKER, {
                    deoptimizeCache() { }
                }) === 'symbol' &&
                    argument1.hasEffectsOnInteractionAtPath(EMPTY_PATH, NODE_INTERACTION_UNKNOWN_CALL, context)));
        },
        returns: UNKNOWN_LITERAL_STRING
    }
};
const objectMembers = assembleMemberDescriptions({
    hasOwnProperty: returnsBoolean,
    isPrototypeOf: returnsBoolean,
    propertyIsEnumerable: returnsBoolean,
    toLocaleString: returnsString,
    toString: returnsString,
    valueOf: returnsUnknown
});
const literalBooleanMembers = assembleMemberDescriptions({
    valueOf: returnsBoolean
}, objectMembers);
const literalNumberMembers = assembleMemberDescriptions({
    toExponential: returnsString,
    toFixed: returnsString,
    toLocaleString: returnsString,
    toPrecision: returnsString,
    valueOf: returnsNumber
}, objectMembers);
export const literalStringMembers = assembleMemberDescriptions({
    anchor: returnsString,
    at: returnsUnknown,
    big: returnsString,
    blink: returnsString,
    bold: returnsString,
    charAt: returnsString,
    charCodeAt: returnsNumber,
    codePointAt: returnsUnknown,
    concat: returnsString,
    endsWith: returnsBoolean,
    fixed: returnsString,
    fontcolor: returnsString,
    fontsize: returnsString,
    includes: returnsBoolean,
    indexOf: returnsNumber,
    italics: returnsString,
    lastIndexOf: returnsNumber,
    link: returnsString,
    localeCompare: returnsNumber,
    match: returnsUnknown,
    matchAll: returnsUnknown,
    normalize: returnsString,
    padEnd: returnsString,
    padStart: returnsString,
    repeat: returnsString,
    replace: stringReplace,
    replaceAll: stringReplace,
    search: returnsNumber,
    slice: returnsString,
    small: returnsString,
    split: returnsUnknown,
    startsWith: returnsBoolean,
    strike: returnsString,
    sub: returnsString,
    substr: returnsString,
    substring: returnsString,
    sup: returnsString,
    toLocaleLowerCase: returnsString,
    toLocaleUpperCase: returnsString,
    toLowerCase: returnsString,
    toString: returnsString,
    toUpperCase: returnsString,
    trim: returnsString,
    trimEnd: returnsString,
    trimLeft: returnsString,
    trimRight: returnsString,
    trimStart: returnsString,
    valueOf: returnsString
}, objectMembers);
export function getLiteralMembersForValue(value) {
    switch (typeof value) {
        case 'boolean': {
            return literalBooleanMembers;
        }
        case 'number': {
            return literalNumberMembers;
        }
        case 'string': {
            return literalStringMembers;
        }
    }
    return Object.create(null);
}
export function hasMemberEffectWhenCalled(members, memberName, interaction, context) {
    if (typeof memberName !== 'string' || !members[memberName]) {
        return true;
    }
    return members[memberName].hasEffectsWhenCalled?.(interaction, context) || false;
}
export function getMemberReturnExpressionWhenCalled(members, memberName) {
    if (typeof memberName !== 'string' || !members[memberName])
        return UNKNOWN_RETURN_EXPRESSION;
    return [members[memberName].returns, false];
}
