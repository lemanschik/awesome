import { getOrCreate } from '../../utils/getOrCreate';
export const UnknownKey = Symbol('Unknown Key');
export const UnknownNonAccessorKey = Symbol('Unknown Non-Accessor Key');
export const UnknownInteger = Symbol('Unknown Integer');
export const SymbolToStringTag = Symbol('Symbol.toStringTag');
export const EMPTY_PATH = [];
export const UNKNOWN_PATH = [UnknownKey];
// For deoptimizations, this means we are modifying an unknown property but did
// not lose track of the object or are creating a setter/getter;
// For assignment effects it means we do not check for setter/getter effects
// but only if something is mutated that is included, which is relevant for
// Object.defineProperty
export const UNKNOWN_NON_ACCESSOR_PATH = [UnknownNonAccessorKey];
export const UNKNOWN_INTEGER_PATH = [UnknownInteger];
const EntitiesKey = Symbol('Entities');
export class PathTracker {
    constructor() {
        this.entityPaths = Object.create(null, {
            [EntitiesKey]: { value: new Set() }
        });
    }
    trackEntityAtPathAndGetIfTracked(path, entity) {
        const trackedEntities = this.getEntities(path);
        if (trackedEntities.has(entity))
            return true;
        trackedEntities.add(entity);
        return false;
    }
    withTrackedEntityAtPath(path, entity, onUntracked, returnIfTracked) {
        const trackedEntities = this.getEntities(path);
        if (trackedEntities.has(entity))
            return returnIfTracked;
        trackedEntities.add(entity);
        const result = onUntracked();
        trackedEntities.delete(entity);
        return result;
    }
    getEntities(path) {
        let currentPaths = this.entityPaths;
        for (const pathSegment of path) {
            currentPaths = currentPaths[pathSegment] =
                currentPaths[pathSegment] ||
                    Object.create(null, { [EntitiesKey]: { value: new Set() } });
        }
        return currentPaths[EntitiesKey];
    }
}
export const SHARED_RECURSION_TRACKER = new PathTracker();
export class DiscriminatedPathTracker {
    constructor() {
        this.entityPaths = Object.create(null, {
            [EntitiesKey]: { value: new Map() }
        });
    }
    trackEntityAtPathAndGetIfTracked(path, discriminator, entity) {
        let currentPaths = this.entityPaths;
        for (const pathSegment of path) {
            currentPaths = currentPaths[pathSegment] =
                currentPaths[pathSegment] ||
                    Object.create(null, { [EntitiesKey]: { value: new Map() } });
        }
        const trackedEntities = getOrCreate(currentPaths[EntitiesKey], discriminator, () => new Set());
        if (trackedEntities.has(entity))
            return true;
        trackedEntities.add(entity);
        return false;
    }
}
