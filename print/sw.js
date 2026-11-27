'use strict';
importScripts('./parts.js?v=7678f6862f41');
const root=new URL('./',self.registration.scope);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==root.origin || !url.pathname.startsWith(root.pathname+'file/')) return;
  const tail=url.pathname.slice((root.pathname+'file/').length);
  const edition=/^([a-f0-9]{64})\/01_Original_Green_All_Sizes\.pdf$/.exec(tail);
  if(!edition) return;
  event.respondWith(serve(event.request,edition[1],url.searchParams.get('ticket')));
});
async function tell(ticket,message) {
  if(!ticket) return;
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients) if(client.url.startsWith(root.href)) client.postMessage({ticket,...message});
}
async function serve(request,id,ticket) {
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
  let data;
  try {data=await CabinetPrint.manifest(root,id);}
  catch {return new Response('This print edition is unavailable.',{status:503,headers:{'Cache-Control':'no-store'}});}
  const etag='"'+id+'"';
  const headers=new Headers({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="01_Original_Green_All_Sizes.pdf"',
    'ETag':etag,'X-Content-SHA256':id,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=31536000, immutable'});
  const conditions=(request.headers.get('if-none-match')||'').split(',').map(s=>s.trim().replace(/^W\//,''));
  if(conditions.includes('*')||conditions.includes(etag))return new Response(null,{status:304,headers});
  const raw=request.headers.get('Range'),ifRange=request.headers.get('If-Range');
  const isRange=!!raw&&(!ifRange||ifRange===etag);
  const range=isRange?CabinetPrint.range(raw,data.bytes):{first:0,last:data.bytes-1};
  if(!range){headers.set('Content-Range','bytes */'+data.bytes);return new Response(null,{status:416,headers});}
  const total=range.last-range.first+1;
  headers.set('Content-Length',String(total));
  if(isRange)headers.set('Content-Range','bytes '+range.first+'-'+range.last+'/'+data.bytes);
  const init={status:isRange?206:200,headers};
  if(request.method==='HEAD')return new Response(null,init);
  const required=[];
  let offset=0;
  for(const part of data.parts){
    const end=offset+part.bytes-1;
    if(end>=range.first&&offset<=range.last)required.push({part,from:Math.max(0,range.first-offset),to:Math.min(end,range.last)-offset+1});
    offset=end+1;
  }
  let index=0,transferred=0,cancelled=false;
  const stream=new ReadableStream({
    async pull(controller){
      try{
        const item=required[index++];
        if(!item){controller.close();return;}
        const raw=await CabinetPrint.read(root,item.part);
        if(cancelled)return;
        const bytes=new Uint8Array(raw,item.from,item.to-item.from);
        controller.enqueue(bytes);
        transferred+=bytes.byteLength;
        await tell(ticket,{completed:transferred,total});
        if(index===required.length)controller.close();
      }catch(e){if(!cancelled){controller.error(e);await tell(ticket,{error:e.message});}}
    },
    cancel(){cancelled=true;}
  });
  return new Response(stream,init);
}
