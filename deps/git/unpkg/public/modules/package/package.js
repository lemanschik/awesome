// A package is a self extracting executable composed out of a readable and a Writeable end.
// entry consist out of 2 array propertys name, kind 
// Best is a array of tgz files where we emit each in a row.
const package = (data) => new ReadableStream({ start(package) {
    package.enqueue(build)
}, seek() {} })
const unpack = () => new TransformStream({ transform(bundle,package) {package.enqueue(build,bundle)} })
const transforms = {
    esmFrom() {}, // Supports rollup config returns rollupBundle
    vite() {}, // Supports vite config returns viteBundle
    package() {}, // Returns the internal webpackage format not get confuesed with webpack thats diffrent.
    // Joins one or more bundels into a single pack for performance. use it like
    //package().pipeThrough(unpack()).pipeThrough(unpack()).pipeThrough(unpack()).pipeTo(new WritableStream())
}

// Since we Readlines we can skip reading and we know also the line index to quick jump.
// ["name",["(data)=>new DecompressionStream("gzip")",...data]]\n; It is not only the definition for data transport it also transports modules and packages.
// In general its a easy stream able string based format that is able to define Flexible DataTypes and even transform them into other.
// ["name",["string is also fine"]]
const typedArray = ([_name,[firstItem, ...data]]=[,[]]) => firstItem === 'number' && new Blob([firstItem,...data]);
const singleString = ([_name,[firstItem, secundItem]]=[,[]]) => typeof firstItem === 'string' && !secundItem && [firstItem];
const stringArray = ([_name,[firstItem, secundItem,...data]]=[,[]]) => typeof firstItem === 'string' && typeof secundItem === 'string' && [firstItem, secundItem,...data];
const objectArray = ([_name,[firstItem, secundItem,...data]]=[,[]]) => typeof firstItem === 'object' && typeof secundItem === 'object' && [firstItem, secundItem,...data];
const singleobject = ([_name,[firstItem, secundItem]]=[,[]]) => typeof firstItem === 'object' && !secundItem && [firstItem];
const nodeFileSystemEntry = ([_name,dirEnt]=[,[]]) => typeof dirEnt[1] === 'symbol' && dirEnt;
const opfsFileSystemEntry = (handle) => handle.name && handle.kind && handle;
const IFileSystemHandle = (handle) => {}

const registredProtocols = ['data:','http:','https:','chrome-extension:'];
const usesChromiumProtocol = ['opfs:','caches:','cache:','broadcast-channel:','rtc:','devtools:','gzip:','worker:','shared-worker:','audio-worklet:'];
const entryUsesRegisteredProtocol = ([_name,[firstItem, secundItem]]=[,[]]) => 
typeof firstItem === 'string' && !secundItem && registredProtocols.find(firstItem.startsWith) 
    ? fetch(firstItem).then(file=>file.blob()) : new Blob([firstItem]);

const getBlobFrom = (entry) => singleString(entry) ? (entryUsesRegisteredProtocol(entry) || new Blob(singleString(entry))) 
    : singleobject(entry) || typedArray(entry) || (stringArray(entry) || objectArray(entry) || entry); 
// if entry is entry its maybe string[] or jsonObject or jsonObject[] in case of object,object it 
// is most likly a kind: 'directory' structure that you should try to recursive parse.  use the entry type property to lookup the kind of the file
// { name: entry[1], kind: entry.type }
// or its a custom structure that you implemented based on file name or extension or path or key prefix this is out of our scope ;)



