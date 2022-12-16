// githubRaw('lemanschik/awesome, 'module/git', 'git.js');
// TODO: Add Url Import Meta Feature for import('github-resolve.js?path=${specifier}/${gitRef}/${fileName}')
export const resolve = (specifier, gitRef, fileName) =>
  `https://raw.githubusercontent.com/${specifier}/${gitRef}/${fileName}`;
