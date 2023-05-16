// Feature Extended DNS for even more.
// running a http server on a local host that binds to all higher ports 2000+ returns chromium-virtual-environments/index.html and 404.html as this repo does.
import { defaultPage } from './responses/main.js'

export const concatArrayBuffer = (buffers) => Uint8Array.from(buffers.flatMap((buffer)=>[...new Uint8Array(buffer)]));
export const GitBlobHash = (url) => fetch(url).then((r) => r.arrayBuffer()).then(
async (arrayBuffer) => crypto.subtle.digest("SHA-1", concatArrayBuffer([new TextEncoder().encode(
//`blob ${'Hello, World!\n'.length}\0${'Hello, World!\n'}`
`blob ${arrayBuffer.size}\0`
),arrayBuffer]) ))
.then((arrayBuffer) => Array.from(new Uint8Array(arrayBuffer),(byte) => byte.toString(16).padStart(2, '0')).join(''))

GitBlobHash(import.meta.url).then(console.log);

// import {fetchMarkdown} from './responses/markdown.js';
//new SharedWorker("./markdown-worker.js");
const scope = new URL('./',import.meta.url);
const registerInitalServiceWorker = async () => { // Update algo
navigator.serviceWorker.register(import.meta.url, { type: 'module', updateViaCache: 'imports', scope});
const currentUrl = new URL(window.location);
currentUrl.hash !== `#${await GitHash}` && navigator.serviceWorker.ready.then(()=> (window.location.hash = await GitHash)));
navigator.serviceWorker.oncontrollerchange = async (event) => { 
	if (navigator.serviceWorker.controller) {
	    console.log(`OK: controlled by: ${await GitHash}`,  navigator.serviceWorker.controller);
	} else {
	    console.log('MAYBE_OK: This page is currently not controlled some one maybe hitted refresh or is first install');		
	}
	currentUrl.searchParams.get('version') !== await GitHash && (currentUrl.searchParams.set('version', await GitHash) || navigator.serviceWorker.ready.then(()=> (window.location = currentUrl)));
}

// Below code will maybe never get called we know that it exists for a reason......
// navigator.serviceWorker.onmessage = ({ version, id, method, params }) => new Function(...params,method)();
navigator.serviceWorker.startMessages();
};

if (globalThis.window) {
  registerInitalServiceWorker();
} else {

let id = 0;
let channel = new BroadcastChannel('serviceWorker');

GitHash.then(console.log);

//Promise.resolve().then(async () => { id: id++, method: `{"oneval":{"version":"${await versionHexString}"}}`, params: JSON.stringify([() => console.log("SW READY") ])})
	//.then(channel.postMessage);

const useCache = async (fn) => caches.open(`stealify-${await GitHash}`).then(fn);
const thirdParty = async (url) => new Response(await (await fetch(url)).text(),{headers:{'content-type':'text/javascript'}})

globalThis.oninstall = async (event) => {
  event.waitUntil(useCache((cache) => cache.addAll([
  `./markdown-worker.js`,`./responses/main.js`,  
	  // "./service-worker.js", never add this to the cache if you do not want to support offline
	  // Todo regular fetch and update logic.
  ]).then(async () => [
  [new URL(scope),defaultPage()],
  [new URL('./index.html',scope),defaultPage()],
  [new URL('./pages',scope),defaultPage()],
  [new URL('./modules/marked.js',scope),await thirdParty('https://raw.githubusercontent.com/markedjs/marked/3acbb7f9abe0edffc0b86197573da47e7845421e/lib/marked.esm.js')]
  ].map(([req,resp]) => cache.put(req,resp))

  
  ) )); globalThis.skipWaiting();
  channel.postMessage(JSON.stringify({ id: id++, method: `{"oninstall":{"version":"${await GitHash}"}}`, params: [() => console.log("SW READY") ]}))
};

const activationHook = async () => {
   globalThis.clients.claim();
   const allClients = await clients.matchAll({
        includeUncontrolled: true,
      });

      let connectedClient;

      // Let's see if we already have a chat window open:
      for (const client of allClients) {
        const url = new URL(client.url);

        if (url.searchParams.has(await GitHash)) {
          // Excellent, let's use it!
          client.focus();
          connectedClient = client;
          break;
        }
      }

      // If we didn't find an existing chat window,
      // open a new one:
      if (!connectedClient) {
        //connectedClient = //await clients.openWindow(scope+'?'+"version="+await versionHexString);
      }
      channel.postMessage(JSON.stringify({ id: id++, method: `{"onactivate":{"version":"${await GitHash}"}}`, params: [() => console.log("SW READY") ]}))
      // Now Clean Ups should happen
};
globalThis.onactivate = async (event) => event.waitUntil(activationHook());

const cachePut = (req) => useCache(new Function(req.body));
// setUrl to let relativ Requests point to new baseUrl. if needed eg js imports and documents containing links
// Promise based router holds functions that return a response if the request matches.
const router = [
	{ condition: (req) => {}, response: Promise.resolve() },
	{ condition: ({url, method}) => url.startsWith(`${scope}`) && method === 'PUT', response: (req) => cachePut(req) },
	{ condition: ({url}) => url === import.meta.url || !url.startsWith(new URL(import.meta.url).origin), response: (req)=> caches.match(req).then(match => match || fetch(req)) },
];	
	
const defaultResponse = (event) => Promise.resolve().then(async () => { // Default Handler
// Exit early if we don't have access to the client.
// Eg, if it's cross-origin.
console.log('onfetch', event.request.url);
if (!event.clientId && !event.resultingClientId) {
	console.log("!event.clientId",{event});
  } 

  if (!event.resultingClientId && !event.clientId) {
	console.log("!event.resultingClientId",{event});
  }

  // Get the client.
  const client = await clients.get(event.clientId);
  // Exit early if we don't get the client. // Eg, if it closed.
  if (!client) {
	console.log("!client so this request is from our self?",{event});
  }

  // Send a message to the client.
  client?.postMessage(JSON.stringify({
	msg: `${event.clientId} Hey I just got a fetch from you!`,
	url: event.request.url,
  }));

  return caches.match(event.request).then(match => match || fetch(event.request)) //fetch('data:text/plain, OK');
})



	
globalThis.onfetch = (event) => {
	// Base Logic let this be a http-server that supports some additional methods for cors
	GitHash.then(console.log);
	
	console.log('onfetch', event.request.headers.method, event.request.url);
	channel.postMessage(JSON.stringify({ id: id++, method: `fetch(${JSON.stringify(event.request)})`, event: event.request.url }))	 
	event.respondWith(router.find(({ condition, response })=> condition(event.request))?.response(event.request) ||
		// event.request.url.startsWith(`${scope}`) && event.request.method === 'PUT' ? cachePut(event.request) :
		// event.request.url === import.meta.url || !event.request.url.startsWith(new URL(import.meta.url).origin)
		//? caches.match(event.request).then(match => match || fetch(event.request))
		defaultResponse(event)
	  );
	};
};
