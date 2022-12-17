export const resolveRawGithub = (githubRef) => `https://raw.githubusercontent.com/${githubRef}`;
export const importMetaUrl = new URL(import.meta.url);
const id = importMetaUrl.searchParams.get('id');
const type = importMetaUrl.searchParams.get('type') || 'raw';

if (!id) {
 throw new Error(`this needs to get imported with a ?id= searchParam`);
}
// TODO: Come up with a nice resolve pattern based on id type for github.com

// Supports import of it self to have a static reference in memory.

export const resolvedRawId = resolveRawGithub(new URL(importMetaUrl).searchParams.get('id')||importMetaUrl.path);
// import('https://github.lemanschik.com/awesome/resolve/github.com.js?id=lemanschik/awesome/components/resolve/github.com.js

// import('https://github.lemanschik.com/awesome/resolve/github.com.js/ experiments.js?id=lemanschik/awesome/components/resolve/github.com.js').then(({ exports }) => exports.git);

// githubRaw('lemanschik/awesome, 'module/git', 'git.js');
// TODO: Add Url Import Meta Feature for import('github-resolve.js?path=${specifier}/${gitRef}/${fileName}')
export const resolve = (specifier, gitRef, fileName) =>
  `https://raw.githubusercontent.com/${specifier}/${gitRef}/${fileName}`;
