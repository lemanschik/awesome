## Editors
This ships with code-oss-web (Open Source VSCODE-WEB) and some Additional Extensions like Web Editors for Homepages and Emails 
It Supports the whole open vsx Market Place as also the Chromium WebStore and Extensions

The Editors are also Including Interfaces to the Terminal Implementation for the Origin. Or you can use the Devtools console 

## NET
Networking gets supplyed via HTTP*,WEBRTC, Extensions API / Devtools Protocol, Direct Sockets API (IsolatedWebApps)

## BTRFS 
This Implements a BTRFS Compatible Storage on top of the caches api each cache gets handled as so called volume
the volume meta data gets stored also inside the cache cache deduplication happens most time on fetch via the service worker
or via using the imperativ ECMAScript Module based API eg inside a SharedWorker or via WASM. 

It exposes a HTTP Enabled Block Device Storage mount able inside Chromium Virtual Environments emulates the machine's processor through dynamic binary translation and provides a set of different hardware and device models for the machine, enabling it to run a variety of guest operating systems. Able to run RISC-V Systems with up to 128 bit instructions or emulate x86_64 or the MAC M2.

It uses VIRTIO as Driver Interface for the Kernels.

## v2
Web bundles provide a way to bundle up groups of HTTP responses, with the request URLs that produced them, to transmit or store together. 
They can include multiple top-level resources, provide random access to their component exchanges, and efficiently store 8-bit resources.
They do so via a service-worker that directly populates the cache. Or Via the Webbundle RFC Served out of the webbundle file. via Chromium isolated
Apps

```
google-chrome-unstable --enable-features=IsolatedWebApps,IsolatedWebAppDevMode \
                       --install-isolated-web-app-from-url=http://localhost:8080
```


use webpack to create a secure isolated bundle
linux/bash
```
openssl genpkey -algorithm ed25519 -out private.pem
```
Chromium
```ts
// Key gen
const ed25519_key = await window.crypto.subtle.generateKey(
  'Ed25519', true /* extractable */, ['sign', 'verify']);
  
const alg = {name: 'Ed25519'};
window.crypto.subtle.sign(alg, ed25519_key.privateKey, data).then(signature =>
  window.crypto.subtle.verify(alg, ed25519_key.publicKey, signature, data))
```

```ts
// Webpack part
const WebBundlePlugin = require('webbundle-webpack-plugin');
const { WebBundleId, parsePemKey } = require('wbn-sign');
const fs = require("fs");
require('dotenv').config({ path: '.env' }); 

const privateKeyFile = process.env.ED25519KEYFILE || "private.pem";
let privateKey;
if (process.env.ED25519KEY) {
  privateKey = process.env.ED25519KEY;
} else if (fs.existsSync(privateKeyFile)) {
  privateKey = fs.readFileSync(privateKeyFile);
}

let webBundlePlugin;
if (privateKey) {
  const parsedPrivateKey = parsePemKey(privateKey);

  webBundlePlugin = new WebBundlePlugin({
    baseURL: new WebBundleId(
      parsedPrivateKey
    ).serializeWithIsolatedWebAppOrigin(),
    output: 'webbundle.swbn',
    integrityBlockSign: {
      key: parsedPrivateKey
    },
  });
} else {
  webBundlePlugin = new WebBundlePlugin({
    baseURL: '/',
    output: 'webbundle.wbn',
  });
}
```


```
google-chrome-unstable --enable-features=IsolatedWebApps,IsolatedWebAppDevMode \
                       --install-isolated-web-app-from-file=$PWD/dist/webbundle.swbn
```

as soon as the app is running you can drop the install flag it gets ignored on start anyway next time.

### v2 Extended Information
You will never ever ship large signed isolated webapps it is common to deploy one isolated signed web app per Organisation
that holds keys for other apps and links them via manifest files they can be normal WebApps and PWA's they get Included Dynamical

```js
cache.put(window.location,new Response(`<html><head></head>${document.body.outerHTML}</html>`,{ 'content-type': 'text/html' }));
//the service worker will return that cached final rendered result of the request on the request so next time
```

Now as we got the ability to call 
```js // Pattern who  what how 
<iframe src="./component.html?component="./modules/processByLine.js?fetch=${new URL('./documentation/index.md',window.location)},window.location)}"></frame>
```
so the component.html offers a baseUrl appURL or origin scope and we use it relativ via forming absolut urls based on the window.location that is component.html
the most clever is that you internal inside your modules replicate the logic as you see in the processByLine.js example when fetch would default to 
generate relativ urls relativ to windoow.lcation we are fine but in this example for documentation we force it.

- url we try to json parse if it fails we try string at present first version supports only string if relativ then relativ to window.location
- import resolves relativ to current html document so window.location if relativ
- method is a property on the imported module that accepts a fetch response and idealy renders to window.document.write.
  -after close: use above put cache method for the service worker which will read that cache and then reuse the result if it is there.
  

## A Clever thing to show on the first page without Query Params maybe?
As it is a Component Manager that manages Components via Caches it is most clever to expose the main component managers service worker caches
as each service worker and component manager only manages own origin scope window.location/*/* and not **/* so not backward 
while caches are not highly compatible they are needed for internal application logic so it is clever to offer caches and opfs so that you can import from to opfs
into caches.

we show a caches and a fileSystem sidebar option. used together with git with cache or opfs filesystem this way you can fine grained conditional sync.


## The correct way to update service workers is
Do not upgrade them!!!! Import scripts that manipulate the same cache as the service worker uses as preferCached and do not look for upgrades 
and do no cache upgrades at all you cache only what you added via imported scripts. This way you even get incremental install in a rolling fashin
let me explain why? Because if some one installs your app and it starts caching via its script execution only it can get updated via a call
that leads to a uncached url that returns new cache.put or cache.addAll calls this cache.addAll Calls could contain other scripts.

if you want for example to cache all resources that a current site loads you can mutation observe the documents for element resources and then put them into the cache
you do not need to depend on micro tasks and render queues. you can put them into the cache async onload. 


so the next version will not only do document write and put into cache they will also put additional resources referenced by the rendered html into the cache
so we can even partial cache only whats needed. eg a user wants to use some stuff offline but not everything. This is needed for large Application Stacks
like the Chromium one it was a big issue to solve this in the correct consistent way as it is hard to refresh caches at a size of some 100gb and even TB
of Web Distributed data via WebRTC and HTTP Block Devices

# chromium-virtual-environments
Chromium Powered Virtual Environments and Systems aka Containers and VM's

## Architectural Effort

### Explainer
As Conclusion of ongoing Architectural Efforts that are WiP i saw the Oportunity to fix the Web and the Platform in One Single Giant Net Wide Iteration
Chromium Team members are familar with the concepts of net wide deprecation via origin trial and other processes.

The Main idea is Unify the Stack as it is possible there is a v8 based runtime experiment that was highly successfull and offers a pattern
to Re Order the Layer Cake and Deprecate MOJO::IPC Replacing it with V8 and a Compiler Feedback Interface

The Above bespoken concepts where highly successfull in Projects like: Oracle GraalVM, JustJS
This got tested via the empowertech benchmarks since over 5 years and so i call it now stable production ready and should get adopted from now on
to save us all time and overall effort to maintain the Platform

Unlike other Architectural Efforts this introduces a new kind of tooling for Polyglot Code Handling in the Platform it self.
So It is a transition from the outer Layers (Shells, Components, EntryPoints,) to v8 Runtimes that get lazy build on demand.

The Chromium Virtual Environments tools include everything neeed from a fully Integrated Development Environment till Versioning
that is out of the Box Isomorphic so it can push and sync results with GOMA or Github anything.......

## Tooling
As this offers a Interactive Integrated Development Environment including P2P Networking and Issue Trackers as also Code Runners
this is indipendent from the chromesource platform while we offer exports and integration into gerrit and chromesource. 

but it is importent to understand that we aim to get indipendent this is a drop in Replacement for: https://source.chromium.org/*
It uses Browser Capabilitys to self host the Repo via Caching it in a highly efficent form without commits only relevant current
merged into the cache without the commit messages. You can configure that behavior ofcourse but this is the rolling release
behavior we do to allow switching away directly from https://source.chromium.org to your local running instance of virtual-environments.chromium.localhost

That is a special configured location you can create it in a indipendent browser profile via installing it as PWA or you load the unpacked
Extension. It Comes with Puppeteer Included so you can fast script your setup.

## License
Everything created with this stack Gets Automaticaly The Unlicense as License while we do hornor contributors and keep a fine grained list of all contributions. But we disagree with current licenses. Everything that gets produced and Pushed to chromium repos gets duo licensed.

You Can always run the internal virtual-environments.chromium.localhost/license tool. when your connected to it.

## License in case of Microsoft Working at Microsoft v0.6
If your a Microsoft Affiliate or Hired by them your not allowed to even view this code talk about it or do anything with it.
Even Merging any none Pushed Changes via Cherry Picking or anything into Microsoft Edge is Strickly Forbidden.
ReUse of any code by the Company called OpenAI or its models is Stricly forbidden! Assembling this into any Bigger Microsoft Project
as substantial used part to build that Project is forbidden. No Microsoft Product is allowed to directly interop with this code.
even not VSCODE. All CODE-OSS Related Extensions will get pushed to Open VSX. 

Microsoft Endusers how ever are free to use the Results from the Community Microsoft it self how ever is not part of that.
Microsoft VSCODE based on CodeOSS and Related Projects Including TypeScripts typechecking got Hardforked while offering
compatability to a degree.

We did try to Onboard them to the Effort but they where not able to full fill the requirements in time and did also. Flag us
so they do not even want backports which is great we fully agree with that! As we think we can implement all that even better.

They did till today not come up with a Working ECMAScript Build while they aim to build ECMAScript nothing more to say about that.

## Google License
Google is allowed to adopt as many parts as they wish as long as they keep The Unlicense as it helps our lawyers and all Companys on earth
if we stop that biased stuff. You are also free to get free white glove onboarding for your team. simple reach out. We keep everything
compatible to the exising build stack as possible and try to Build Indipendent via the new Rolling Incremental Build that happens on Demand.

Your also free to talk to us about the interals of our jsonp cross origin transport implementations and concepts to adopt them as sollutions
and maybe champion them internal. We have no intend to do so as it is waisted energie and we can Build and Run without such processes.
as we got inherent version control we are even able to build and run Many Platforms form the same build results On Demand in Millisecunds.
Thanks to a perfect aligned Binary System and flexible linking. 

We also got a internal wish list of Googlers we would love to onboard as they did in the past contribute a lot of good concepts and we would
love to expand that relation as also give them some inspiration and concepts.
