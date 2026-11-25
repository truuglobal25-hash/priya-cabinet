'use strict';
(async()=>{
  const root=new URL('./',location.href);
  const button=document.querySelector('#download'),state=document.querySelector('#status'),progress=document.querySelector('#progress');
  let active=false, skipWorker=false, data,ticket;
  function status(message){state.textContent=message;}
  function percent(done,total){
    progress.hidden=false;progress.max=total;progress.value=done;
    status(Math.round(done/total*100)+'% downloaded');
  }
  function ended(){
    active=false;button.disabled=false;button.textContent='Download again';progress.hidden=true;
    status('Your print PDF is ready in your downloads.');
  }
  function problem(error){
    active=false;button.disabled=false;progress.hidden=true;button.textContent='Try download again';
    status(error.message||'The download was interrupted. Please try again.');
  }
  function save(url){
    const link=document.createElement('a');link.href=url;link.download='01_Original_Green_All_Sizes.pdf';
    document.body.append(link);link.click();link.remove();
  }
  async function workerReady(){
    if(!navigator.serviceWorker || !isSecureContext)return false;
    try{
      await navigator.serviceWorker.register(new URL('sw.js',root),{scope:root.pathname,updateViaCache:'none'});
      await Promise.race([navigator.serviceWorker.ready,new Promise((_,fail)=>setTimeout(()=>fail(Error()),5000))]);
      if(!navigator.serviceWorker.controller){
        await new Promise(resolve=>{
          const end=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',end);resolve();};
          const timer=setTimeout(end,1500);navigator.serviceWorker.addEventListener('controllerchange',end);
        });
      }
      return !!navigator.serviceWorker.controller;
    }catch{return false;}
  }
  const worker=workerReady();
  navigator.serviceWorker?.addEventListener('message',e=>{
    if(e.data?.ticket!==ticket)return;
    if(e.data.error){skipWorker=true;problem(Error(e.data.error));return;}
    percent(e.data.completed,e.data.total);
    if(e.data.completed===e.data.total)ended();
  });
  async function start(){
    if(active||!data)return;
    active=true;button.disabled=true;status('Preparing your print file…');
    try{
      if(!skipWorker && await worker){
        const file=new URL('file/'+data.sha256+'/01_Original_Green_All_Sizes.pdf',root);
        const test=await fetch(file,{method:'HEAD',cache:'no-store'});
        if(test.ok && test.headers.get('X-Content-SHA256')===data.sha256){
          ticket=crypto.randomUUID();file.searchParams.set('ticket',ticket);
          const transferFrame=document.createElement('iframe');
          transferFrame.hidden=true;transferFrame.title='Print PDF download';transferFrame.src=file.href;
          document.body.append(transferFrame);status('Starting the download…');
          setTimeout(()=>{if(active && progress.hidden){active=false;skipWorker=true;button.disabled=false;status('If the download did not start, use the download button to save the full PDF.');}},10000);
          return;
        }
      }
      const chunks=[];let done=0;
      for(const part of data.parts){
        chunks.push(new Blob([await CabinetPrint.read(root,part)]));done+=part.bytes;percent(done,data.bytes);
      }
      const blob=new Blob(chunks,{type:'application/pdf'});
      if(blob.size!==data.bytes)throw Error('The file is incomplete. Please try again.');
      const url=URL.createObjectURL(blob);save(url);setTimeout(()=>URL.revokeObjectURL(url),120000);ended();
    }catch(e){problem(e);}
  }
  button.addEventListener('click',start);
  try{
    const response=await fetch(new URL('current.json',root),{cache:'no-store'});
    if(!response.ok)throw Error('The print edition could not be opened.');
    const current=await response.json();data=await CabinetPrint.manifest(root,current.sha256);
    status(Math.round(data.bytes/1000000)+' MB · Print PDF');button.disabled=false;
    if(new URL(location.href).searchParams.get('download')==='1')await start();
  }catch(e){status(e.message);}
})();
