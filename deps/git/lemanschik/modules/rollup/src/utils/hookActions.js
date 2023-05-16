import { EventEmitter } from 'node:events';
import process from 'node:process';
function formatAction([pluginName, hookName, parameters]) {
    const action = `(${pluginName}) ${hookName}`;
    const s = JSON.stringify;
    switch (hookName) {
        case 'resolveId': {
            return `${action} ${s(parameters[0])} ${s(parameters[1])}`;
        }
        case 'load': {
            return `${action} ${s(parameters[0])}`;
        }
        case 'transform': {
            return `${action} ${s(parameters[1])}`;
        }
        case 'shouldTransformCachedModule': {
            return `${action} ${s(parameters[0].id)}`;
        }
        case 'moduleParsed': {
            return `${action} ${s(parameters[0].id)}`;
        }
    }
    return action;
}
// We do not directly listen on process to avoid max listeners warnings for
// complicated build processes
const beforeExitEvent = 'beforeExit';
const beforeExitEmitter = new EventEmitter();
beforeExitEmitter.setMaxListeners(0);
process.on(beforeExitEvent, () => beforeExitEmitter.emit(beforeExitEvent));
export async function catchUnfinishedHookActions(pluginDriver, callback) {
    let handleEmptyEventLoop;
    const emptyEventLoopPromise = new Promise((_, reject) => {
        handleEmptyEventLoop = () => {
            const unfulfilledActions = pluginDriver.getUnfulfilledHookActions();
            reject(new Error(`Unexpected early exit. This happens when Promises returned by plugins cannot resolve. Unfinished hook action(s) on exit:\n` +
                [...unfulfilledActions].map(formatAction).join('\n')));
        };
        beforeExitEmitter.once(beforeExitEvent, handleEmptyEventLoop);
    });
    const result = await Promise.race([callback(), emptyEventLoopPromise]);
    beforeExitEmitter.off(beforeExitEvent, handleEmptyEventLoop);
    return result;
}
