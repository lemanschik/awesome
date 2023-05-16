import { DiscriminatedPathTracker, PathTracker } from './utils/PathTracker';
export const BROKEN_FLOW_NONE = 0;
export const BROKEN_FLOW_BREAK_CONTINUE = 1;
export const BROKEN_FLOW_ERROR_RETURN_LABEL = 2;
export function createInclusionContext() {
    return {
        brokenFlow: BROKEN_FLOW_NONE,
        includedCallArguments: new Set(),
        includedLabels: new Set()
    };
}
export function createHasEffectsContext() {
    return {
        accessed: new PathTracker(),
        assigned: new PathTracker(),
        brokenFlow: BROKEN_FLOW_NONE,
        called: new DiscriminatedPathTracker(),
        ignore: {
            breaks: false,
            continues: false,
            labels: new Set(),
            returnYield: false
        },
        includedLabels: new Set(),
        instantiated: new DiscriminatedPathTracker(),
        replacedVariableInits: new Map()
    };
}
