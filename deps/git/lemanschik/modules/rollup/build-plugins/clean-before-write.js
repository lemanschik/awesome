import fs from 'fs-extra';
export default function cleanBeforeWrite(directory) {
    let removePromise = null;
    return {
        generateBundle(_options, _bundle, isWrite) {
            if (isWrite) {
                // Only remove before first write, but make all writes wait on the removal
                removePromise || (removePromise = fs.remove(directory));
                return removePromise;
            }
        },
        name: 'clean-before-write'
    };
}
