# The WebContainer/BrowserContainer Spec
A Web Container Consists mainly out of 2 parts the init aka boot and the data.
Together they form a Component that is fully Containered.

WebContainers are fully Compatible to any other ECMAScript Bundler and Shipping 
format as they come with own loaders remember the init, boot.

The Main Storage and shipping format for the web container spec is Stealify FileHandle
a Stealify FileHandle consists out of the main propertys ref, ...data as String/JSON/Uint8Array
stored inside of a regular JSON Array. 

This Storage format is ultra efficent as it is ideal for processing and deployment at the same time.
It is even designed to allow live mutation of the data if needed to even save more Computation.

Look into fs/pack* unpack* for examples. 

The Format is designed for streaming and loading while doing so. 

when a Stealify FileHandle eg holds for example ECMAScript Module code you can do this

```ts
const [ref,code] = stealifyFileHandle;

const modules = {};
modules[ref] = await import(new Blob([code,{ type: 'application/javascript' }]));
```

You can also load anything else for example you could load images sound files any files
and store them programatical as for example Module, DOMElement, DB, FileSystem, .....
possebilitys are endless.
