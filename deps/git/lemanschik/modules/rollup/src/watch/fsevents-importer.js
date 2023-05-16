let fsEvents;
let fsEventsImportError;
export async function loadFsEvents() {
    try {
        ({ default: fsEvents } = await import('fsevents'));
    }
    catch (error) {
        fsEventsImportError = error;
    }
}
// A call to this function will be injected into the chokidar code
export function getFsEvents() {
    if (fsEventsImportError)
        throw fsEventsImportError;
    return fsEvents;
}
