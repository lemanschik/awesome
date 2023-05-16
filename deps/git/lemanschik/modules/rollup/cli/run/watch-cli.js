import { promises as fs } from 'node:fs';
import process from 'node:process';
import chokidar from 'chokidar';
import dateTime from 'date-time';
import ms from 'pretty-ms';
import onExit from 'signal-exit';
import * as rollup from '../../src/node-entry';
import { bold, cyan, green, underline } from '../../src/utils/colors';
import relativeId from '../../src/utils/relativeId';
import { handleError, stderr } from '../logging';
import { getConfigPath } from './getConfigPath';
import { loadConfigFile } from './loadConfigFile';
import loadConfigFromCommand from './loadConfigFromCommand';
import { getResetScreen } from './resetScreen';
import { printTimings } from './timings';
import { createWatchHooks } from './watchHooks';
export async function watch(command) {
    process.env.ROLLUP_WATCH = 'true';
    const isTTY = process.stderr.isTTY;
    const silent = command.silent;
    let watcher;
    let configWatcher;
    let resetScreen;
    const configFile = command.config ? await getConfigPath(command.config) : null;
    const runWatchHook = createWatchHooks(command);
    onExit(close);
    process.on('uncaughtException', close);
    if (!process.stdin.isTTY) {
        process.stdin.on('end', close);
        process.stdin.resume();
    }
    async function loadConfigFromFileAndTrack(configFile) {
        let configFileData = null;
        let configFileRevision = 0;
        configWatcher = chokidar.watch(configFile).on('change', reloadConfigFile);
        await reloadConfigFile();
        async function reloadConfigFile() {
            try {
                const newConfigFileData = await fs.readFile(configFile, 'utf8');
                if (newConfigFileData === configFileData) {
                    return;
                }
                configFileRevision++;
                const currentConfigFileRevision = configFileRevision;
                if (configFileData) {
                    stderr(`\nReloading updated config...`);
                }
                configFileData = newConfigFileData;
                const { options, warnings } = await loadConfigFile(configFile, command);
                if (currentConfigFileRevision !== configFileRevision) {
                    return;
                }
                if (watcher) {
                    await watcher.close();
                }
                start(options, warnings);
            }
            catch (error) {
                handleError(error, true);
            }
        }
    }
    if (configFile) {
        await loadConfigFromFileAndTrack(configFile);
    }
    else {
        const { options, warnings } = await loadConfigFromCommand(command);
        await start(options, warnings);
    }
    async function start(configs, warnings) {
        watcher = rollup.watch(configs);
        watcher.on('event', event => {
            switch (event.code) {
                case 'ERROR': {
                    warnings.flush();
                    handleError(event.error, true);
                    runWatchHook('onError');
                    break;
                }
                case 'START': {
                    if (!silent) {
                        if (!resetScreen) {
                            resetScreen = getResetScreen(configs, isTTY);
                        }
                        resetScreen(underline(`rollup v${rollup.VERSION}`));
                    }
                    runWatchHook('onStart');
                    break;
                }
                case 'BUNDLE_START': {
                    if (!silent) {
                        let input = event.input;
                        if (typeof input !== 'string') {
                            input = Array.isArray(input)
                                ? input.join(', ')
                                : Object.values(input).join(', ');
                        }
                        stderr(cyan(`bundles ${bold(input)} → ${bold(event.output.map(relativeId).join(', '))}...`));
                    }
                    runWatchHook('onBundleStart');
                    break;
                }
                case 'BUNDLE_END': {
                    warnings.flush();
                    if (!silent)
                        stderr(green(`created ${bold(event.output.map(relativeId).join(', '))} in ${bold(ms(event.duration))}`));
                    runWatchHook('onBundleEnd');
                    if (event.result && event.result.getTimings) {
                        printTimings(event.result.getTimings());
                    }
                    break;
                }
                case 'END': {
                    runWatchHook('onEnd');
                    if (!silent && isTTY) {
                        stderr(`\n[${dateTime()}] waiting for changes...`);
                    }
                }
            }
            if ('result' in event && event.result) {
                event.result.close().catch(error => handleError(error, true));
            }
        });
    }
    async function close(code) {
        process.removeListener('uncaughtException', close);
        // removing a non-existent listener is a no-op
        process.stdin.removeListener('end', close);
        if (watcher)
            await watcher.close();
        if (configWatcher)
            configWatcher.close();
        if (code) {
            // eslint-disable-next-line unicorn/no-process-exit
            process.exit(code);
        }
    }
}
