// returns the webbundle when it is ready.
const webbundle = caches.open(import.meta.url).then(async cache=> await Promise.all([[new Request(), new Response() || cache.match(new Request({ url: 'other cached url' }))]].map(([req,res]) => cache.put(req,res))) && cache);
