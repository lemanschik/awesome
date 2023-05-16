// readableStream emits absolute pathLikes
export const unpackStream = (readableStream) => 
Promise.resolve(({CompressionStream, DecompressionStream, ReadableStream, TransformStream, TextDecoderStream})||import('node:stream/web')).then(
async ({CompressionStream, DecompressionStream, ReadableStream, TransformStream, TextDecoderStream }) => {
    const { promises: fsPromises } = await import('node:fs');
    const {resolve, join} = await import('node:path');
    readableStream
    .pipeThrough(new TransformStream({ async transform(dirPath,c){
        const getRecursiveFiles = async (dirPath) => {
            (await fsPromises.readdir(dirPath)).forEach(async (file) => {
              if ((await fsPromises.stat(dirPath + "/" + file)).isDirectory()) {
                getRecursiveFiles(dirPath + "/" + file)
              } else {
                c.enqueue(join(dirPath, "/", file))
              }
            });    
        };        
        getRecursiveFiles(dirPath);
    }}))
    .pipeThrough(new TransformStream({ async transform(filePath,controller){
        console.log(filePath.length)
        // const filePath,content = JSON:parse(line) // content === Array<Uint8>
        // new Response(content).text(),json(), blob(), arrayBuffer, or Uint8Array.from(content);
        controller.enqueue(`["${filePath}",[${[...await fsPromises.readFile(filePath)]}]]\n`);
    }}))
    .pipeThrough(new CompressionStream('gzip'));
    //.pipeTo(new WritableStream({ async write(){ 
        // [directoryParts,...memfsFileEntrie]
        //new Response(content).text(),json(), blob(), arrayBuffer, or ;
        
        // controller.enqueue([filePath.split('/')],[Uri.parse(`memfs:${filePath}`),Uint8Array.from(content),{ create: true, overwrite: true }]);
        // directoryParts.pop();
        // memfs.createDirectory(directoryParts.join('/'), {create: true});
        // memfs.writeFile(...memfsFileEntrie);
    //}}));
});
