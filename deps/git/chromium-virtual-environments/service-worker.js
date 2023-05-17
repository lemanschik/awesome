globalThis?.window && globalThis?.window.location.protocol !== 'https:' && (globalThis.window.location.protocol = 'https:');
export const serviceWorker = globalThis.window ? globalThis.window.navigator.serviceWorker : globalThis;
export const channel = new BroadcastChannel("service-worker::");

export const concatArrayBuffer = (buffers) => Uint8Array.from(buffers.flatMap((buffer)=>[...new Uint8Array(buffer)]));
export const GitBlobHash = (url) => fetch(url).then((r) => r.arrayBuffer()).then(
async (arrayBuffer) => crypto.subtle.digest("SHA-1", concatArrayBuffer([new TextEncoder().encode(
//`blob ${'Hello, World!\n'.length}\0${'Hello, World!\n'}`
`blob ${arrayBuffer.size}\0`
),arrayBuffer]) ))
.then((arrayBuffer) => Array.from(new Uint8Array(arrayBuffer),(byte) => byte.toString(16).padStart(2, '0')).join(''))

// Interisting observation a Promise does not cache its last result when it gets reused its like using a function.
let GitHash = GitBlobHash(import.meta.url).then((hash)=>(GitHash = Promise.resolve(hash)));

if (globalThis.window) {
const boot = (ComponentManager={}) => Object.assign(ComponentManager,{ async boot(c) {
  if ("serviceWorker" in navigator) {

  } else {
    // The current browser doesn't support service workers.
    // Perhaps it is too old or we are not in a Secure Context.
  }
  
  // For NodeJS Backward Compatability AwesomeOS has no concept of a Process!.
  ComponentManager.process = `ÀwesomeOS`;
  ComponentManager.version = await GitHash;
  ComponentManager.fs = {};
  ComponentManager.net = {};
  ComponentManager.serviceWorker = globalThis.window.navigator.serviceWorker;
  ComponentManager.protocol = new TransformStream({transform: 
  (controller,func) => controller.enqueue(new Function(func)(ComponentManager))});
  
  const scope = new URL('./',import.meta.url);
  await ComponentManager.serviceWorker.register(import.meta.url,
  { type: 'module', updateViaCache: 'all', scope}).then((reg) => {
    // serviceWorker.state 
    document.querySelector("#service-worker")?.textContent = `${['installing','active','waiting'].find(
    status=>reg[status])} and is controller: ${serviceWorker.active === serviceWorker.controller}`;
    
    serviceWorker.addEventListener("statechange", (e) => {
      // logState(e.target.state);
    });
  
    reg.update() 
  },(error) => {
  // Something went wrong during registration. The service-worker.js file
  // might be unavailable or contain a syntax error.
  });
  
  console.log("Status:", ComponentManager.serviceWorker.installing, ComponentManager.serviceWorker.controller)
  
  if (ComponentManager.serviceWorker.controller && ComponentManager.serviceWorker.installing) {
    console.log('New content is available; please refresh.');
    window.history.pushState = function () {
      window.history.pushState.apply(window.history, arguments);
      ComponentManager.serviceWorker.installing?.postMessage({ method: "skipWaiting", params: [] });
    };
  };
  c.enqueue(ComponentManager);
  // Upgrades of the System on next Reboot if needed
  // Can Reboot in Background and Switch over with Zero Downtime.

}}) && ({
  start: (c) => ComponentManager.boot(c),
});

new ReadableStream(boot()).pipeThrough(new TransformStream({ 
    transform: (ComponentManager,c)=>{
      console.log(ComponentManager);
      ComponentManager.serviceWorker.onmessage = (msg) => c.enqueue(msg);
        ComponentManager.serviceWorker.startMessages(); // Does Inital Deployment for Offline Scenarios also handels Programatical
        // here your code runs this.startUI() for example
        channel.onmessage = (msg)=>c.enqueue(msg);
        c.enqueue(`System Booted ${ComponentManager.process}`)
    },
    startUI: () => {},
})).pipeTo(new WritableStream({write(data){console.log(data)}}))








} else {
const serviceWorker = globalThis;
GitHash.then(hash=>console.log("instantiation:",hash)||channel.postMessage({ "instantiating": hash }))
  //console.log("instantiating:", await GitHash);

const methods = { 
  async skipWaiting(){
    console.log("installing:",await GitHash);
    channel.postMessage({ "installing:": await GitHash })
    serviceWorker.skipWaiting();
  }, 
  "clients.claim": async () => {    
    console.log("activating:",await GitHash);
    channel.postMessage({ "activating:": await GitHash })
    serviceWorker.clients.claim();
    const allClients = await serviceWorker.clients.matchAll({
      includeUncontrolled: true,
    });

    const connectedClient = allClients.find(async (cl)=>new URL(cl.url).searchParams.has(await GitHash));
    // connectedClient?.focus();

    // If we didn't find an existing chat window, // open a new one:
    if (!connectedClient) {
      //connectedClient = //await clients.openWindow(scope+'?'+"version="+await versionHexString);
    }
    channel.postMessage({ method: "window.refresh", params: [] })
  },
}; 

serviceWorker.oninstall = (event) => event.waitUntil(methods.skipWaiting())
serviceWorker.onactivate = (event) => event.waitUntil(methods["clients.claim"]())
serviceWorker.onmessage = ({data: { id, method, params = [] }}) => {
  methods[method](...params); // skipWaiting clients.claim()
};

serviceWorker.onfetch = (event) => event.waitUntil(caches.match(event.request) || caches.match(event.request,{ignoreSearch:true})||fetch(event.request));
/** The Fundamental Concepts */
/**
 * You get a Boot Stream that emits a HigerOrder ComponentManager which can pass down Capabilitys.
 * This is called Capability based Permissions you can find a lot of information on the www
 * After Boot and Init you write to the Final Output Eg Headless, Or Logging, Or UI Or something else.
 * On servers your write target is mostly the logging infra local or remote
 * On Consumer UI Instances its most time the UI it self which has configuration to additional log as needed.
 * On Development Instances you probally did forward the Streams into your IDE Some how or your IDE Even Runs with
 * Escalated Permissions Inside the Main Component Manager for Faster iteration and debugging.
 */
// "compilerOptions": {
//     "target": "esnext",
//     "moduleResolution": "bundler",
//     "customConditions": ["import"],
//     "verbatimModuleSyntax": true,
//     "composite": true,
    
// }

// tsc --build -p ./my-project-dir 
// --declaration
// --emitDeclarationOnly
// --declarationMap
// --sourceMap
// --inlineSourceMap

}
