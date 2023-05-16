import { stderr } from '../logging';
const CLEAR_SCREEN = '\u001Bc';
export function getResetScreen(configs, allowClearScreen) {
    let clearScreen = allowClearScreen;
    for (const config of configs) {
        if (config.watch && config.watch.clearScreen === false) {
            clearScreen = false;
        }
    }
    if (clearScreen) {
        return (heading) => stderr(CLEAR_SCREEN + heading);
    }
    let firstRun = true;
    return (heading) => {
        if (firstRun) {
            stderr(heading);
            firstRun = false;
        }
    };
}
