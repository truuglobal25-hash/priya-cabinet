'use strict';
importScripts('./files.js?v=shelf-scale-019b8074f3');
const scope = new URL('./', self.registration.scope);
const base = new URL('../', scope);
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url), relative = url.pathname.slice(scope.pathname.length);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname + 'file/')) return;
  const target = /^file\/(18|24|36)\/(pdf|zip)\/([a-f0-9]{64})\/(.+)$/.exec(relative);
  if (target) event.respondWith(download(event.request, target, url.searchParams.get('ticket')));
});

async function download(request, [,width,type,checksum,name], ticket) {
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405});
  let output;
  try { output = await CabinetFiles.edition(base,width,type); }
  catch { return new Response('Cabinet download unavailable.',{status:503}); }
  const {file} = output;
  if (file.sha256 !== checksum || file.filename !== name) return new Response(null,{status:404});
  const etag = '"'+checksum+'"';
  const headers = new Headers({'Content-Type':type==='pdf'?'application/pdf':'application/zip', 'Content-Disposition':'attachment; filename="'+name+'"', 'ETag':etag, 'X-Content-SHA256':checksum, 'Accept-Ranges':'bytes', 'Cache-Control':'public, max-age=31536000, immutable'});
  if ((request.headers.get('If-None-Match')||'').split(/,\s*/).some(tag=>tag === '*' || tag.replace(/^W\//,'')===etag)) return new Response(null,{status:304,headers});
  const ifRange = request.headers.get('If-Range');
  const rangeHeader = !ifRange || ifRange===etag ? request.headers.get('Range') : null;
  const limits = CabinetFiles.range(rangeHeader,file.bytes);
  if (!limits) {headers.set('Content-Range','bytes */'+file.bytes); return new Response(null,{status:416,headers});}
  const [start,end] = limits;
  headers.set('Content-Length',String(end-start));
  if (rangeHeader) headers.set('Content-Range',`bytes ${start}-${end-1}/${file.bytes}`);
  const options={status:rangeHeader?206:200,headers};
  if (request.method==='HEAD') return new Response(null,options);
  const iterator = CabinetFiles.chunks(base,output,start,end);
  let completed=0, cancelled=false, lastNotification=0;
  async function notify(error) {
    if (!ticket) return;
    const now=Date.now();
    if (!error && completed!==end-start && now-lastNotification<250) return;
    lastNotification=now;
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of clients) if (client.url.startsWith(scope.href)) client.postMessage({ticket, completed,total:end-start,error});
  }
  return new Response(new ReadableStream({
    async pull(controller) {
      try {
        const {value,done}=await iterator.next();
        if (cancelled) return;
        if (done){controller.close();return;}
        controller.enqueue(value);
        completed+=value.length;
        if (completed===end-start){controller.close();await iterator.return();}
        await notify();
      } catch(error){if (!cancelled) {controller.error(error);await notify(error.message);}}
    },
    cancel(){cancelled=true;return iterator.return();}
  }),options);
}
