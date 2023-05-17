import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { errorMissingExternalConfig } from '../../src/utils/error';
import { handleError } from '../logging';
const DEFAULT_CONFIG_BASE = 'rollup.config';
export async function getConfigPath(commandConfig) {
    if (commandConfig === true) {
        return resolve(await findConfigFileNameInCwd());
    }
    if (commandConfig.slice(0, 5) === 'node:') {
        const packageName = commandConfig.slice(5);
        try {
            // eslint-disable-next-line unicorn/prefer-module
            return require.resolve(`rollup-config-${packageName}`, { paths: [cwd()] });
        }
        catch {
            try {
                // eslint-disable-next-line unicorn/prefer-module
                return require.resolve(packageName, { paths: [cwd()] });
            }
            catch (error) {
                if (error.code === 'MODULE_NOT_FOUND') {
                    handleError(errorMissingExternalConfig(commandConfig));
                }
                throw error;
            }
        }
    }
    return resolve(commandConfig);
}
async function findConfigFileNameInCwd() {
    const filesInWorkingDirectory = new Set(await fs.readdir(cwd()));
    for (const extension of ['mjs', 'cjs', 'ts']) {
        const fileName = `${DEFAULT_CONFIG_BASE}.${extension}`;
        if (filesInWorkingDirectory.has(fileName))
            return fileName;
    }
    return `${DEFAULT_CONFIG_BASE}.js`;
}
