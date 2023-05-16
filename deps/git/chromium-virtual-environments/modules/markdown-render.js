/** 
 * Renders window.location.searchParams.url via fetching it and then streaming html to the document.
 * Accepts hooks via Mutation Observer if you want to do or need to do some inection patterns.
 * Todo: marked is not ready to be used as stream 
 */
//import { fetchWithLineIterator } from './fetchTextFileLineIterator.js';
import { parse } from './marked.esm.js';

const importMetaUrl = new URL(import.meta.url);
const windowLocation = new URL(window.location)
console.log({ windowLocation, importMetaUrl })
export const fetchRender = (url = windowLocation.searchParams?.get('url'), doc = window.document) => 
fetch(new URL(url,windowLocation)).then((r) => r.text()).then(parse)
  .then((innerHTML) => doc.body.innerHTML = innerHTML); // Atomic. Mutation Hooks still work ofcourse.
  //fetchWithLineIterator(url,(line)=>doc.write(parse(line))).then((done=true)=>
// Here comes the put cache logic.
//);

caches.match(importMetaUrl.pathname).then(exists=>exists || caches.open(importMetaUrl.pathname).then(cache=>cache.addAll([importMetaUrl.pathname,'./modules/marked.esm.js','./service-worker.js'])))


windowLocation.searchParams?.has('url') ? windowLocation.searchParams.get('url').endsWith('.md') && fetchRender()
: importMetaUrl.searchParams?.has('url') && fetchRender(new URL(importMetaUrl.searchParams.get('url'),windowLocation));
