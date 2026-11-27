'use strict';
(async()=>{
  const query=new URLSearchParams(location.search);
  const width=['18','24','36'].includes(query.get('size'))?query.get('size'):'36';
  const status=document.querySelector('#status'),button=document.querySelector('#download'),progress=document.querySelector('#progress');
  document.querySelector('#title').textContent=width+'″ cabinet panels in 4K';
  document.querySelector('a[href="?size='+width+'"]').setAttribute('aria-current','true');
  document.querySelector('#back').href='../?size='+width;
  const bytesHash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),v=>v.toString(16).padStart(2,'0')).join('');
  let bundle;
  async function read(part,signal){
    for(let n=0;n<3;n++){
      try{
        const res=await fetch('./parts/'+part.sha256+'.bin',{cache:n?'reload':'default',signal});
        if(!res.ok)throw Error();
        const bytes=await res.arrayBuffer();
        if(bytes.byteLength!==part.bytes || await bytesHash(bytes)!==part.sha256)throw Error();
        return bytes;
      }catch(err){if(signal.aborted||n===2)throw err;}
    }
  }
  async function start(){
    if(button.disabled)return;
    button.disabled=true;progress.hidden=false;progress.value=0;status.textContent='Preparing your 4K ZIP…';
    const controller=new AbortController();
    try{
      // All three archives fit within 26 MB, including the largest 36-inch artwork.
      const list=new Array(bundle.parts.length);
      progress.max=bundle.bytes;
      let nextIndex=0;
      async function readParts(){
        while(nextIndex<bundle.parts.length && !controller.signal.aborted){
          const index=nextIndex++;
          const block=await read(bundle.parts[index],controller.signal);
          if(controller.signal.aborted)return;
          list[index]=block;
          progress.value+=block.byteLength;
          status.textContent=Math.round(100*progress.value/bundle.bytes)+'% downloaded';
        }
      }
      const workers=Math.min(4,bundle.parts.length);
      await Promise.all(Array.from({length:workers},readParts));
      const zip=new Blob(list,{type:'application/zip'});
      if(zip.size!==bundle.bytes || await bytesHash(await zip.arrayBuffer())!==bundle.sha256)throw Error();
      const url=URL.createObjectURL(zip),a=document.createElement('a');
      a.href=url;a.download=bundle.filename;document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
      status.textContent='Your six-panel ZIP is ready.';button.textContent='Download again';
    }catch(err){
      controller.abort();
      status.textContent='The download was interrupted. Try again.';button.textContent='Try again';
    }finally{button.disabled=false;progress.hidden=true;}
  }
  try{
    const res=await fetch('./manifest.json',{cache:'no-cache'});if(!res.ok)throw Error();
    bundle=(await res.json())[width];
    const hex=s=>/^[0-9a-f]{64}$/.test(s);
    if(bundle.filename!=='Yusuf-Green-Cabinet-'+width+'in-All-Panels-4K.zip' || !hex(bundle.sha256) ||
       !Array.isArray(bundle.parts)||bundle.parts.some(p=>!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>3*1024*1024||!hex(p.sha256)) ||
       bundle.parts.reduce((sum,p)=>sum+p.bytes,0)!==bundle.bytes || bundle.bytes>30e6)throw Error();
    status.textContent='Six full-resolution PNG panels · '+Math.round(bundle.bytes/1e6)+' MB';
    button.disabled=false;button.addEventListener('click',start);
    if(query.get('download')==='1')await start();
  }catch(err){status.textContent='The panel list could not be loaded. Reload this page to try again.';}
})();
