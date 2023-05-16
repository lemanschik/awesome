import { execSync } from 'node:child_process';
import { bold, cyan } from '../../src/utils/colors';
import { stderr } from '../logging';
function extractWatchHooks(command) {
    if (!Array.isArray(command.watch))
        return {};
    return command.watch
        .filter(value => typeof value === 'object')
        .reduce((accumulator, keyValueOption) => ({ ...accumulator, ...keyValueOption }), {});
}
export function createWatchHooks(command) {
    const watchHooks = extractWatchHooks(command);
    return function (hook) {
        if (watchHooks[hook]) {
            const cmd = watchHooks[hook];
            if (!command.silent) {
                stderr(cyan(`watch.${hook} ${bold(`$ ${cmd}`)}`));
            }
            try {
                // !! important - use stderr for all writes from execSync
                const stdio = [process.stdin, process.stderr, process.stderr];
                execSync(cmd, { stdio: command.silent ? 'ignore' : stdio });
            }
            catch (error) {
                stderr(error.message);
            }
        }
    };
}
