import { handleError } from '../../cli/logging';
import { ensureArray } from '../utils/ensureArray';
import { error, errorInvalidOption } from '../utils/error';
import { mergeOptions } from '../utils/options/mergeOptions';
import { WatchEmitter } from './WatchEmitter';
import { loadFsEvents } from './fsevents-importer';
export default function watch(configs) {
    const emitter = new WatchEmitter();
    watchInternal(configs, emitter).catch(error => {
        handleError(error);
    });
    return emitter;
}
async function watchInternal(configs, emitter) {
    const optionsList = await Promise.all(ensureArray(configs).map(config => mergeOptions(config)));
    const watchOptionsList = optionsList.filter(config => config.watch !== false);
    if (watchOptionsList.length === 0) {
        return error(errorInvalidOption('watch', 'watch', 'there must be at least one config where "watch" is not set to "false"'));
    }
    await loadFsEvents();
    const { Watcher } = await import('./watch');
    new Watcher(watchOptionsList, emitter);
}
