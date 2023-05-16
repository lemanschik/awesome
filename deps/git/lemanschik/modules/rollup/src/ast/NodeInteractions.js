import { UNKNOWN_EXPRESSION } from './nodes/shared/Expression';
export const INTERACTION_ACCESSED = 0;
export const INTERACTION_ASSIGNED = 1;
export const INTERACTION_CALLED = 2;
export const NODE_INTERACTION_UNKNOWN_ACCESS = {
    thisArg: null,
    type: INTERACTION_ACCESSED
};
export const UNKNOWN_ARG = [UNKNOWN_EXPRESSION];
export const NODE_INTERACTION_UNKNOWN_ASSIGNMENT = {
    args: UNKNOWN_ARG,
    thisArg: null,
    type: INTERACTION_ASSIGNED
};
export const NO_ARGS = [];
// While this is technically a call without arguments, we can compare against
// this reference in places where precise values or thisArg would make a
// difference
export const NODE_INTERACTION_UNKNOWN_CALL = {
    args: NO_ARGS,
    thisArg: null,
    type: INTERACTION_CALLED,
    withNew: false
};
