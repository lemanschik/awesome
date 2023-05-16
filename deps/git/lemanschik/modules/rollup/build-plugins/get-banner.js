import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { env } from 'node:process';
import { promisify } from 'node:util';
const execPromise = promisify(exec);
function generateBanner(commitHash, version) {
    const date = new Date(env.SOURCE_DATE_EPOCH ? 1000 * +env.SOURCE_DATE_EPOCH : Date.now()).toUTCString();
    return `/*
  @license
	Rollup.js v${version}
	${date} - commit ${commitHash}

	https://github.com/rollup/rollup

	Released under the MIT License.
*/`;
}
let getBannerPromise = null;
export default function getBanner() {
    return (getBannerPromise || (getBannerPromise = Promise.all([
        execPromise('git rev-parse HEAD')
            .then(({ stdout }) => stdout.trim())
            .catch(error => {
            console.error('Could not determine commit hash:', error);
            return 'unknown';
        }),
        fs.readFile(new URL('../package.json', import.meta.url), 'utf8')
    ]).then(([commit, package_]) => generateBanner(commit, JSON.parse(package_).version))));
}
