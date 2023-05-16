//export const git = Promise.resolve(`https://raw.githubusercontent.com/${specifier}/${gitRef}/${fileName}`)
export const cloudUi = Promise.resolve(`https://raw.githubusercontent.com/awesome/module/cloud/cloud.js`).then((resolvedId) => import(resolvedId));

