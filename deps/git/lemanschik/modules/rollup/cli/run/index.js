import { env } from 'node:process';
import { errorDuplicateImportOptions, errorFailAfterWarnings } from '../../src/utils/error';
import { isWatchEnabled } from '../../src/utils/options/mergeOptions';
import { getAliasName } from '../../src/utils/relativeId';
import { loadFsEvents } from '../../src/watch/fsevents-importer';
import { handleError } from '../logging';
import build from './build';
import { getConfigPath } from './getConfigPath';
import { loadConfigFile } from './loadConfigFile';
import loadConfigFromCommand from './loadConfigFromCommand';
export default async function runRollup(command) {
    let inputSource;
    if (command._.length > 0) {
        if (command.input) {
            handleError(errorDuplicateImportOptions());
        }
        inputSource = command._;
    }
    else if (typeof command.input === 'string') {
        inputSource = [command.input];
    }
    else {
        inputSource = command.input;
    }
    if (inputSource && inputSource.length > 0) {
        if (inputSource.some((input) => input.includes('='))) {
            command.input = {};
            for (const input of inputSource) {
                const equalsIndex = input.indexOf('=');
                const value = input.slice(Math.max(0, equalsIndex + 1));
                const key = input.slice(0, Math.max(0, equalsIndex)) || getAliasName(input);
                command.input[key] = value;
            }
        }
        else {
            command.input = inputSource;
        }
    }
    if (command.environment) {
        const environment = Array.isArray(command.environment)
            ? command.environment
            : [command.environment];
        for (const argument of environment) {
            for (const pair of argument.split(',')) {
                const [key, ...value] = pair.split(':');
                env[key] = value.length === 0 ? String(true) : value.join(':');
            }
        }
    }
    if (isWatchEnabled(command.watch)) {
        await loadFsEvents();
        const { watch } = await import('./watch-cli');
        watch(command);
    }
    else {
        try {
            const { options, warnings } = await getConfigs(command);
            try {
                for (const inputOptions of options) {
                    await build(inputOptions, warnings, command.silent);
                }
                if (command.failAfterWarnings && warnings.warningOccurred) {
                    warnings.flush();
                    handleError(errorFailAfterWarnings());
                }
            }
            catch (error) {
                warnings.flush();
                handleError(error);
            }
        }
        catch (error) {
            handleError(error);
        }
    }
}
async function getConfigs(command) {
    if (command.config) {
        const configFile = await getConfigPath(command.config);
        const { options, warnings } = await loadConfigFile(configFile, command);
        return { options, warnings };
    }
    return await loadConfigFromCommand(command);
}
