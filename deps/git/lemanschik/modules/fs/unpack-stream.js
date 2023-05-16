// Remove the export and undocument the below code to run this inside nodejs as cjs code
const unpackStream = (readableStream) => 
// Promise.resolve(({CompressionStream, DecompressionStream, ReadableStream, TransformStream, TextDecoderStream})||import('node:stream/web')).then(
// async ({CompressionStream, DecompressionStream, ReadableStream, TransformStream, TextDecoderStream }) => {
    readableStream
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(new TextDecoderStream('utf8'))
    .pipeThrough(new TransformStream({
        transform(chunk, controller) {
            this._buffer = this._buffer || [];
            
            // see: http://www.unicode.org/reports/tr18/#Line_Boundaries
            const lines = chunk.split(/\r\n|[\n\v\f\r\x85\u2028\u2029]/g)
            // don't split CRLF which spans chunks
            if (this._lastChunkEndedWithCR && chunk[0] == '\n') {
              lines.shift()
            }
            
            if (this._buffer.length > 0) {
              this._buffer[this._buffer.length - 1] += lines[0]
              lines.shift()
            }
            
            this._lastChunkEndedWithCR = chunk[chunk.length - 1] == '\r'
            this._buffer.push(...lines)
      
            // always buffer the last (possibly partial) line
            while (this._buffer.length > 1) {
              const line = this._buffer.shift()
              console.log('lineout',line.split(',')[0])
              line.length && controller.enqueue(line);
            }
          },
          flush(controller) {
            this._buffer.reverse().forEach(line => line.length && controller.enqueue(line));
            this._buffer.length = 0;
          },
    }))
    .pipeThrough(new TransformStream({ async transform(line, controller){
        const [filePath,content] = JSON.parse(line) // content === Array<Uint8>
        controller.enqueue([filePath, Uint8Array.from(content)]);
    }}));
    //.pipeTo(new WritableStream({ async write(){ 
        // [directoryParts,...memfsFileEntrie]
        //new Response(content).text(),json(), blob(), arrayBuffer, or ;
        
        // controller.enqueue([filePath.split('/')],[Uri.parse(`memfs:${filePath}`),Uint8Array.from(content),{ create: true, overwrite: true }]);
        // directoryParts.pop();
        // memfs.createDirectory(directoryParts.join('/'), {create: true});
        // memfs.writeFile(...memfsFileEntrie);
    //}}));
// });
