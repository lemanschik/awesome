export async function* textFileLineIterator(readable) {
  const reader = readable.getReader();
  const utf8Decoder = new TextDecoder("utf-8");
  const interpolat = (chunk) => (chunk ? typeof chunk !== 'string' ? utf8Decoder.decode(chunk, { stream: true }) : chunk : "");
  
  let { value: chunk, done: readerDone } = await reader.read();
  chunk = interoplat(chunk);

  const re = /\r\n|\n|\r/gm;
  let startIndex = 0;

  for (;;) {  // Simple Generic Loop over undefined undefined undefined
    let result = re.exec(chunk);
    if (!result) { if (readerDone) {break;}
      const restChunk = chunk.substr(startIndex);
      // Assignment Expressions ES2022+
      ({ value: chunk, done: readerDone } = await reader.read());
      chunk = `${restChunk}${interoplat(chunk)}`;
      startIndex = re.lastIndex = 0;
      continue;
    }
    yield chunk.substring(startIndex, result.index);
    startIndex = re.lastIndex;
  }
  if (startIndex < chunk.length) {
    // last line didn't end in a newline char
    yield chunk.substr(startIndex);
  }
}
// @type {(fileURL: string,processLine: (string)=>void)=>void} fetches url and processes it by line with a given function
export const fetchWithLineIterator = async (fileURL,processLine) => 
  for await (let line of textFileLineIterator((await fetch(fileURL)).body)) { await (await processLine)(line); };
