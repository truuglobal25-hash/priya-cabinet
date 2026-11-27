'use strict';
(async () => {
  const query = new URLSearchParams(location.search);
  const width = ['18','24','36'].includes(query.get('size')) ? query.get('size') : '36';
  const directory = new URL('./', location.href), base = new URL('../', directory);
  const status = document.querySelector('#status'), progress = document.querySelector('#progress');
  const zip = document.querySelector('#download'), pdf = document.querySelector('#print-file');
  const buttons = {zip,pdf};
  const types = ['zip','pdf'];
  const files = {};
  let transfer, skipWorker=false;
  document.querySelector('#title').textContent = width+'″ cabinet artwork';
  document.querySelector('nav a[href="?size='+width+'"]').setAttribute('aria-current','true');
  document.querySelector('#back').href='../?size='+width;
  function busy(active){for (const button of Object.values(buttons)) button.disabled=active;}
  function state(text){status.textContent=text;}
  function showProgress(current,total) {
    if (!transfer) return;
    progress.hidden=false;progress.max=total;progress.value=current;
    const percent=Math.floor(current/total*100);
    if (percent!==transfer.percent){transfer.percent=percent;state(percent+'% downloaded');}
  }
  function finish(text){transfer=null;busy(false);progress.hidden=true;state(text);}
  function complete(){finish('Your download is ready.');}
  async function connect() {
    if (!navigator.serviceWorker || !isSecureContext) return false;
    try {
      await navigator.serviceWorker.register(new URL('file-worker.js',directory), {scope:directory.pathname,updateViaCache:'none'});
      await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error()),6000))]);
      if (!navigator.serviceWorker.controller) await new Promise(resolve=>{
        const end=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',end);resolve();};
        const timer=setTimeout(end,1800);navigator.serviceWorker.addEventListener('controllerchange',end);
      });
      return Boolean(navigator.serviceWorker.controller);
    } catch {return false;}
  }
  const connected=connect();
  navigator.serviceWorker?.addEventListener('message',event=>{
    const message=event.data;
    if (!transfer || message?.ticket!==transfer.id) return;
    if (message.error){skipWorker=true;finish('The download was interrupted. Select the file to try again.');return;}
    showProgress(message.completed,message.total);
    if (message.completed===message.total) complete();
  });
  async function blobDownload(output, type) {
    const chunks=[], partial=[];
    let buffered=0,done=0;
    for await (const bytes of CabinetFiles.chunks(base,output,0,output.file.bytes)) {
      // Copy small slices immediately so retained views cannot pin many 16 MiB sources.
      partial.push(bytes.byteLength < bytes.buffer.byteLength/2 ? bytes.slice() : bytes);
      buffered+=bytes.byteLength;
      if (buffered>=1024*1024){chunks.push(new Blob(partial));partial.length=0;buffered=0;}
      done+=bytes.byteLength;showProgress(done,output.file.bytes);
    }
    if (partial.length) chunks.push(new Blob(partial));
    const blob=new Blob(chunks,{type:type==='pdf'?'application/pdf':'application/zip'});
    if (blob.size!==output.file.bytes) throw Error('Incomplete download.');
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download=output.file.filename;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),120000);complete();
  }
  async function start(type) {
    if (transfer || !files[type]) return;
    transfer={id:crypto.randomUUID(),percent:-1};const id=transfer.id;
    busy(true);progress.hidden=true;state('Preparing your download…');
    try {
      const output=files[type], file=output.file;
      if (!skipWorker && await connected) {
        const url=new URL('file/'+width+'/'+type+'/'+file.sha256+'/'+file.filename,directory);
        const head=await fetch(url,{method:'HEAD',cache:'no-store'});
        if (head.ok&&head.headers.get('X-Content-SHA256')===file.sha256) {
          url.searchParams.set('ticket',id);
          const frame=document.createElement('iframe');frame.hidden=true;frame.title='Cabinet file download';
          frame.src=url.href;document.body.append(frame);state('Starting your download…');
          setTimeout(()=>{
            if (transfer?.id===id && transfer.percent<0){skipWorker=true;finish('If your download did not start, select the file to try again.');}
          },45000);
          return;
        }
      }
      await blobDownload(output,type);
    } catch {finish('The download was interrupted. Select the file to try again.');}
  }
  try {
    await Promise.all(types.map(async type=>{
      const output=await CabinetFiles.edition(base,width,type);
      files[type]=output;
      buttons[type].textContent=(type==='zip'?'Download 4K ZIP':'Download print PDF')+' · '+Math.round(output.file.bytes/1e6)+' MB';
      buttons[type].addEventListener('click',()=>start(type));
    }));
    busy(false);state('');
    const requested=query.get('download');
    if (['1','zip','pdf'].includes(requested)) await start(requested==='pdf'?'pdf':'zip');
  } catch {state('The download list is unavailable. Reload this page to try again.');}
})();
