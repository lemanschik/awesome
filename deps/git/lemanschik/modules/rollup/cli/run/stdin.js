import process from 'node:process';
export const stdinName = '-';
let stdinResult = null;
export function stdinPlugin(argument) {
    const suffix = typeof argument == 'string' && argument.length > 0 ? '.' + argument : '';
    return {
        load(id) {
            if (id === stdinName || id.startsWith(stdinName + '.')) {
                return stdinResult || (stdinResult = readStdin());
            }
        },
        name: 'stdin',
        resolveId(id) {
            if (id === stdinName) {
                return id + suffix;
            }
        }
    };
}
function readStdin() {
    return new Promise((resolve, reject) => {
        const chunks = [];
        process.stdin.setEncoding('utf8');
        process.stdin
            .on('data', chunk => chunks.push(chunk))
            .on('end', () => {
            const result = chunks.join('');
            resolve(result);
        })
            .on('error', error => {
            reject(error);
        });
    });
}
