//export const git = Promise.resolve(`https://raw.githubusercontent.com/${specifier}/${gitRef}/${fileName}`)
export const git = Promise.resolve(`https://raw.githubusercontent.com/awesome/module/git/git.js`).then((resolvedId) => import(resolvedId));

