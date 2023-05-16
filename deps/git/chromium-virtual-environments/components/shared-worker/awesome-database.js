export const sharedWorker = globalThis.window ? new SharedWorker(import.meta.url) : undefined;
export let id = 0
if (!sharedWorker) {
  const workerId = crypto.randomUUID();
  globalThis.onconnect = ({ports:[port]}) => {
    port.postMessage({ workerId, id: id++, method: "(workerId,importUrl)=>console.log(`${workerId} Running: ${importUrl}`)", params: [workerId,import.meta.url] })
    port.onmessage = () => 
  }

}
// new Function(`return import("data:text/javascript,export const hi = 'world'; console.log(hi)")`)().then(({ hi })=>console.log(hi));
//export example `import().then(({port})=>{ 
//port.onmessage = ({ workerId, id, method, params}) => new Function(method).call(globalThis,params)
//port
//})`;
