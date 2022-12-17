export const resolveRawGithub = (githubRef) => `https://raw.githubusercontent.com/${githubRef}`;
export const importMetaUrl = new URL(import.meta.url);
const id = importMetaUrl.searchParams.get('id');

if (!id) {
 throw new Error(`this needs to get imported with a ?id= searchParam`);
}

// import('https://github.lemanschik.com/awesome/resolve/raw-github.js?id=lemanschik/awesome/components/resolve/raw-github.js
export const resolvedId = resolveRawGithub(new URL(importMetaUrl).searchParams.get('id'));

export const resolveBlobId = (r) => r.blob().then((blob) => new Blob([blob], { type: "text/javascript" }));
export const resolvedBlobId = fetch(resolvedId).then(resolveBlobId);

export const moduleExports = (r) => resolveBlobId(r).then(window.URL.createObjectURL)
  .then((resolvedId) => import(resolvedId, new URL(r.url)));




// import('https://github.lemanschik.com/awesome/resolve/github.com.js/ experiments.js?id=lemanschik/awesome/components/resolve/github.com.js').then(({ exports }) => exports.git);

