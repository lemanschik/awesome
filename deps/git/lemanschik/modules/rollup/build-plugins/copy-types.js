import { resolve } from 'node:path';
import fs from 'fs-extra';
export default function copyTypes(fileName) {
    return {
        async generateBundle(_options, _bundle, isWrite) {
            if (isWrite) {
                this.emitFile({
                    fileName,
                    source: await fs.readFile(resolve('src/rollup/types.d.ts'), 'utf8'),
                    type: 'asset'
                });
            }
        },
        name: 'copy-types'
    };
}
