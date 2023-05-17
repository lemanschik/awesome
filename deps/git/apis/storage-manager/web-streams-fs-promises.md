## Copyed mainly from my stackoverflow
https://stackoverflow.com/questions/44672942/stream-response-to-file-using-fetch-api-and-fs-createwritestream/73879265#73879265

with nodejs 18+ 

```
node -e 'fetch("https://github.com/stealify").then(response => stream.Readable.fromWeb(response.body).pipe(fs.createWriteStream("./github.com_stealify.html")))'
```

in the above example we use the -e flag it tells nodejs to execute our cli code we download the page of a interristing Project here and save it as ./github.com_stealify.html in the current working dir the below code shows the same inside a nodejs .mjs file for convinience

Cli example using CommonJS
```
node -e 'fetch("https://github.com/stealify").then(({body:s}) =>
 stream.Readable.fromWeb(s).pipe(fs.createWriteStream("./github.com_stealify.html")))'
```

fetch.cjs
```js
fetch("https://github.com/stealify").then(({body:s}) => 
 require("node:stream").Readable.fromWeb(s)
  .pipe(require("node:fs").createWriteStream("./github.com_stealify.html")));
```

Cli example using ESM
```
node --input-type module -e 'stream.Readable.fromWeb(
 (await fetch("https://github.com/stealify")).body)
  .pipe(fs.createWriteStream("./github.com_stealify.html"))'
```

fetch_tla_no_tli.mjs
```js
(await import("node:stream")).Readable.fromWeb(
 (await fetch("https://github.com/stealify")).body).pipe(
  (await import("node:fs")).createWriteStream("./github.com_stealify.html"));
```

fetch.mjs
```js
import stream from 'node:stream';
import fs from 'node:fs';
stream.Readable
  .fromWeb((await fetch("https://github.com/stealify")).body)
  .pipe(fs.createWriteStream("./github.com_stealify.html"));
```

see: https://nodejs.org/api/stream.html#streamreadablefromwebreadablestream-options

## Update i would not use this method when dealing with files
this is the correct usage as fs.promises supports all forms of iterators equal to the stream/consumers api
```sh
node -e 'fetch("https://github.com/stealify").then(({ body }) =>
 fs.promises.writeFile("./github.com_stealify.html", body)))'
```
