const markedModule = (caches.match(new URL('../modules/marked.js',import.meta.url)) || caches.open("stealify")
    .then((cache) => cache.put(new URL('../modules/marked.js',import.meta.url),fetch('https://raw.githubusercontent.com/markedjs/marked/3acbb7f9abe0edffc0b86197573da47e7845421e/lib/marked.esm.js')
                               .then(async r=>new Response(await r.text(),{headers:{'content-type':'text/javascript'}}))))).then(()=>import('../modules/marked.js'));
const processMarkdown = async (md) => new Response((await markedModule).parse(await md.text()), {headers:{'content-type': 'text/html'}})
export const fetchMarkdown = ({request:{url,headers}}) => cache.match(url) || fetch(url).then(new URL(url).searchParams.has('html') ? processMarkdown : (r)=>r);
