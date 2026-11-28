'use strict';

const sizes = [18, 24, 36];
const faces = ['rear', 'left', 'right', 'header', 'lip', 'toe'];
const links = {
  '#overview':'overview', '#front':'front', '#rear':'rear', '#left':'left', '#right':'right',
  '#header':'header', '#rear-streax':'rear-streax', '#rear-powders':'rear-powders',
  '#face-serums':'serum', '#streax':'streax', '#hair-serums':'streax-serums',
  '#buds-roots':'buds', '#wowish-skincare':'skincare', '#soft-touch':'soft', '#gel-scrub-soaps':'soft-shelf',
  '#streax-colours':'streax-colours', '#streax-serums':'streax-serums',
  '#buds-powders':'buds-powders', '#buds-teas':'buds-teas',
  '#wowish-washes':'wowish-washes', '#wowish-oils':'wowish-oils',
  '#soft-touch-sun-care':'soft-sun', '#rear-soft-touch':'rear-soft'
};
const hashFor = Object.fromEntries(Object.entries(links).map(([hash,name]) => [name,hash]));
hashFor.streax = '#streax';

const clamp = (value,a,b) => Math.max(a,Math.min(b,value));
const radians = degrees => degrees*Math.PI/180;
const orbitViews = new Set(['overview','front','rear','left','right']);
const orbitSpeed = 9; // Degrees per second, one turn in 40 seconds.
const overviewHalf = (width,aspect) => Math.max(29.5,(Math.hypot(width/2,6)+2)/aspect);
const widthFromURL = url => {
  const value = new URL(url).searchParams.get('size');
  return sizes.find(w=>String(w)===value) || 36;
};

function cabinetGeometry(width) {
  const h=width/2, inner=width-1, edge=.017, result={};
  const uv=[[0,0],[1,0],[1,1],[0,1]];
  function quad(key,points,normal) {
    const data=result[key] ||= [];
    for (const i of [0,1,2,0,2,3]) data.push(...points[i],...normal,...uv[i]);
  }
  function box(x,y,z,w,d,t) {
    const a=x-w/2,b=x+w/2,c=y-d/2,e=y+d/2,f=z-t/2,g=z+t/2;
    quad('boards',[[a,c,f],[b,c,f],[b,c,g],[a,c,g]],[0,-1,0]);
    quad('boards',[[b,e,f],[a,e,f],[a,e,g],[b,e,g]],[0,1,0]);
    quad('boards',[[a,e,f],[a,c,f],[a,c,g],[a,e,g]],[-1,0,0]);
    quad('boards',[[b,c,f],[b,e,f],[b,e,g],[b,c,g]],[1,0,0]);
    quad('boards',[[a,c,g],[b,c,g],[b,e,g],[a,e,g]],[0,0,1]);
    quad('boards',[[a,e,f],[b,e,f],[b,c,f],[a,c,f]],[0,0,-1]);
  }
  function front(key,half,y,bottom,top) {
    quad(key,[[-half,y,bottom],[half,y,bottom],[half,y,top],[-half,y,top]],[0,-1,0]);
  }
  box(-h+.25,0,26,.5,12,52);
  box(h-.25,0,26,.5,12,52);
  box(0,5.76,26,inner,.48,52);
  box(0,-5.75,1.5,inner,.5,3);
  [3,14.5,26,37.5,44].forEach((top,i)=>{
    box(0,-.24,top-.25,inner,11.52,.5);
    if (i) front('lip',h-.52,-6.004,top-.48,top-.02);
  });
  quad('rear',[[h-edge,6.007,edge],[-h+edge,6.007,edge],[-h+edge,6.007,52-edge],[h-edge,6.007,52-edge]],[0,1,0]);
  quad('left',[[-h-.007,6-edge,edge],[-h-.007,-6+edge,edge],[-h-.007,-6+edge,52-edge],[-h-.007,6-edge,52-edge]],[-1,0,0]);
  quad('right',[[h+.007,-6+edge,edge],[h+.007,6-edge,edge],[h+.007,6-edge,52-edge],[h+.007,-6+edge,52-edge]],[1,0,0]);
  front('header',h-.525,5.508,44.02,51.98);
  front('toe',h-.52,-6.006,.025,2.98);
  quad('floor',[[-55,-55,-.06],[55,-55,-.06],[55,55,-.06],[-55,55,-.06]],[0,0,1]);
  return result;
}

function viewPose(name,width,aspect,art) {
  const base=overviewHalf(width,aspect);
  const fixed=(yaw,pitch,aim,halfHeight,halfWidth) => ({
    yaw,pitch,aim,offsetX:0,offsetY:0,zoom:base/Math.max(halfHeight,halfWidth/aspect)
  });
  const rearBrand={'rear-streax':'streax','rear-powders':'buds',serum:'wowish','rear-soft':'soft'}[name];
  if (rearBrand) {
    const [x,y,w,h]=art.stations[rearBrand];
    const caption=art.captions?.[rearBrand] || [0,width];
    // Keep the serum close-up centered on the four packs at every screen width.
    const include=(name==='serum'||name==='rear-soft')?0:clamp((aspect-.76)/.58,0,1);
    const l=x+include*(Math.min(x,caption[0])-x);
    const r=x+w+include*(Math.max(x+w,caption[1])-(x+w));
    const pose=fixed(180,0,52-y-h/2,h/2+.34,(r-l)/2+.34);
    pose.offsetX=width/2-(l+r)/2;
    return pose;
  }
  const crop=art.details?.[name];
  if (crop && ['streax-colours','streax-serums','buds-powders','buds-teas','wowish-washes','wowish-oils','soft-sun','soft-shelf'].includes(name)) {
    const [x,y,w,h]=crop.rect;
    if (name==='soft-shelf') {
      const pose=fixed(90,0,52-y-h/2,h/2+.05,w/2+.05);
      pose.offsetY=x+w/2-6;
      return pose;
    }
    return fixed(crop.face==='left'?270:90,0,52-y-h/2,h/2+.09,Math.max(x+w-6,6-x)+.1);
  }
  if (name==='header') return fixed(0,0,48,4.34,width/2+.28);
  if (name==='left'||name==='right') return fixed(name==='left'?270:90,0,26,27.8,6.45);
  if (name==='streax'||name==='buds'||name==='skincare'||name==='soft') {
    return fixed(name==='streax'||name==='skincare'?270:90,0,
      {streax:36.4,buds:36.35,skincare:12.75,soft:12.75}[name],12.2,6.45);
  }
  const [yaw,pitch]={front:[-9,5],rear:[180,2],overview:[212,7]}[name] || [212,7];
  return {yaw,pitch,aim:26,offsetX:0,offsetY:0,zoom:1};
}

function startViewer() {
  const canvas=document.querySelector('main canvas'), poster=document.querySelector('#poster');
  const statusNote=document.querySelector('#status'), viewSelect=document.querySelector('#views');
  const spinButton=document.querySelector('#spin'), plus=document.querySelector('#in'), minus=document.querySelector('#out');
  const radios=[...document.querySelectorAll('#cabinet-size input[name="cabinet-size"]')];
  const manifest=window.cabinetSizes;
  const wide=window.matchMedia('(min-aspect-ratio: 1/1)');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const manager={...viewPose('overview',36,1,{}),spinning:false,view:links[location.hash]||'overview',current:null};
  let selected=widthFromURL(location.href), loaded=0, epoch=0, renderer=null, staticMode=false, elevation=null;
  // A manual pause or explicit opt-in is shared across widths and camera presets.
  let rotationChoice=null;
  const currentArt=()=>manifest[selected];
  const aspect=()=>Math.max(.1,canvas.parentElement.clientWidth/Math.max(1,canvas.parentElement.clientHeight));

  const main=canvas.parentElement;
  const ink=createCabinetInk(main,canvas);
  function posterFrame() {
    if(poster.hidden || poster.dataset.view!=='overview' || !poster.complete || !poster.naturalWidth)return null;
    const r=poster.getBoundingClientRect(), ar=poster.naturalWidth/poster.naturalHeight;
    const w=Math.min(r.width,r.height*ar), h=w/ar, height=2*overviewHalf(selected,ar)/1.025;
    return {bounds:{left:r.left+(r.width-w)/2,top:r.top+(r.height-h)/2,width:w,height:h},
            frame:{yaw:212,pitch:8.5,targetX:0,targetY:0,targetZ:25.6,width:height*ar,height}};
  }
  function paintFlatInk() {
    if(elevation) { ink.elevation(selected,elevation); return; }
    const entry=posterFrame();
    if(entry) ink.model(selected,entry.frame,poster,entry.bounds);
    else ink.hide();
  }
  const flatZoom=staticCabinetZoom(main,minus,plus,()=>staticMode,()=>elevation || poster,paintFlatInk);
  poster.addEventListener('load',()=>{if(!poster.hidden)paintFlatInk();});
  const labels=startLabelViewer(open=>renderer?.holdLabels(open));
  let tapped=null;
  function hitAt(x,y) {
    if (elevation) {
      const m=elevation.getScreenCTM();
      if (!m) return null;
      const p=new DOMPoint(x,y).matrixTransform(m.inverse());
      const box=elevation.viewBox.baseVal;
      if(p.x<box.x || p.x>box.x+box.width || p.y<box.y || p.y>box.y+box.height)return null;
      return labelAt(elevation.dataset.panel,p.x,p.y,selected);
    }
    if (!poster.hidden) {
      const entry=posterFrame();
      return entry?projectedLabel(x,y,entry.bounds,entry.frame,selected):null;
    }
    if (canvas.hidden || !canvas.dataset.frameInches) return null;
    return projectedLabel(x,y,canvas.getBoundingClientRect(),JSON.parse(canvas.dataset.frameInches),selected);
  }
  main.addEventListener('pointerdown',e=>{
    tapped=null;
    if(e.button!==0 || !e.isPrimary || e.target.closest('a'))return;
    const id=hitAt(e.clientX,e.clientY);
    if(labels.has(id))tapped={id,pointer:e.pointerId,x:e.clientX,y:e.clientY};
  },true);
  main.addEventListener('pointermove',e=>{
    if(tapped && e.pointerId===tapped.pointer && Math.hypot(e.clientX-tapped.x,e.clientY-tapped.y)>7)tapped=null;
    if(e.pointerType==='mouse' && !e.buttons)main.classList.toggle('label-target',labels.has(hitAt(e.clientX,e.clientY)) && !e.target.closest('a'));
  },true);
  main.addEventListener('pointerleave',()=>main.classList.remove('label-target'));
  main.addEventListener('pointercancel',()=>{tapped=null;});
  main.addEventListener('pointerup',e=>{
    if(tapped && e.pointerId===tapped.pointer && Math.hypot(e.clientX-tapped.x,e.clientY-tapped.y)<=7)labels.open(tapped.id);
    tapped=null;
  },true);

  const wowishDownload=document.querySelector('#download-wowish');
  const wowishShelvesURL=wowishDownload.getAttribute('href');
  const wowishShelvesFile=wowishDownload.download;
  function setWowishDownload(view) {
    const aloeLink=document.querySelector('#aloe-label');
    aloeLink.style.display=['soft-shelf','soft','rear-soft'].includes(view)?'inline-flex':'none';
    const serum=view==='serum', title=serum?'Wowish serums':'Wowish shelves';
    wowishDownload.href=serum?'./packshots/wowish-serums-sharp-4k.png':wowishShelvesURL;
    wowishDownload.download=serum?'Wowish-Face-Serums-4K.png':wowishShelvesFile;
    wowishDownload.setAttribute('aria-label','Download 4K '+title);
    wowishDownload.querySelector('.standard-label').textContent='Download 4K '+title;
    wowishDownload.querySelector('.compact-label').textContent='4K '+title;
  }

  function uiSize() {
    setWowishDownload(manager.view);
    radios.forEach(input=>{input.checked=Number(input.value)===selected;});
    const dimensions=document.querySelector('#cabinet-dimensions');
    if (dimensions) dimensions.textContent=selected+'″ W × 52″ H × 12″ D';
    const pages=document.querySelector('#print-pages');
    if (pages) pages.textContent=selected+'″ · PDF pages '+({18:'1–6',24:'7–12',36:'13–18'}[selected]);
    for (const a of document.querySelectorAll('#cabinet-film,#fallback-film,#download-film')) {
      const film=currentArt().film;
      if (film) {a.href=film;a.dataset.filmWidth=String(selected);}
      else a.removeAttribute('href');
    }
    const filename = 'Yusuf-Overseas-Green-Cabinet-' + selected + 'in';
    document.querySelector('#download-film').download = filename + '-4K.mp4';
    const artworkDownload = document.querySelector('#download-art');
    artworkDownload.href = './green-cabinet/cabinet-' + selected + '-rear-4k.png?v=' + (selected === 18 ? '2128b0168718' : '019b8074f315');
    artworkDownload.download = filename + '-Rear-4K.png';
    const panels = document.querySelector('#download-panels');
    panels.href = './4k-panels/?size=' + selected + '&download=1';
    panels.setAttribute('aria-label', 'Download 4K panels and the print PDF for the ' + selected + '-inch cabinet');
    Object.assign(canvas.dataset,{cabinetWidth:String(selected),cabinetHeight:'52',cabinetDepth:'12'});
    document.dispatchEvent(new CustomEvent('cabinet-size-change',{bubbles:true,detail:{width:selected,depth:12,height:52}}));
  }

  function clipToShelf(element) {
    let clip='';
    if (manager.view==='soft-shelf' || manager.view==='wowish-washes') {
      const main=canvas.parentElement, w=main.clientWidth, h=main.clientHeight;
      const [, , width, height] = currentArt().details[manager.view].rect;
      const ratio=manager.view==='soft-shelf' ? (width+.1)/(height+.1) : (width+.2)/(height+.18);
      const vertical=Math.max(0,Math.round((h-w/ratio)/2));
      const horizontal=Math.max(0,Math.round((w-h*ratio)/2));
      clip='inset('+vertical+'px '+horizontal+'px)';
    }
    if (element.style.clipPath!==clip) element.style.clipPath=clip;
  }

  // Some high-detail crop files are served in small pieces for reliable mobile downloads.
  const detailBlobs=new Map();
  async function checkedDetail(url,expected,bytes) {
    for(let attempt=0;attempt<3;attempt++){
      try {
        const response=await fetch(url,{cache:attempt?'reload':'default'});
        if(!response.ok)throw Error('Could not download cabinet detail.');
        const data=await response.arrayBuffer();
        const digest=await crypto.subtle.digest('SHA-256',data);
        const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        if(data.byteLength!==bytes || hex!==expected)throw Error('Cabinet detail checksum failed.');
        return data;
      } catch(error) { if(attempt===2)throw error; }
    }
  }
  function detailURL(detail) {
    if(!detail.parts)return Promise.resolve(detail.image);
    if(!detailBlobs.has(detail.sha256)){
      const loading=Promise.all(detail.parts.map(([hash,size])=>
        checkedDetail('./green-cabinet/detail-parts/'+hash+'.bin',hash,size)
      )).then(async pieces=>{
        const image=new Blob(pieces,{type:'image/webp'});
        const digest=await crypto.subtle.digest('SHA-256',await image.arrayBuffer());
        const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
        if(hex!==detail.sha256)throw Error('Cabinet detail checksum failed.');
        return URL.createObjectURL(image);
      }).catch(error=>{detailBlobs.delete(detail.sha256);throw error;});
      detailBlobs.set(detail.sha256,loading);
    }
    return detailBlobs.get(detail.sha256);
  }

  function imageAttemptURL(source,attempt) {
    if(!attempt)return source;
    const url=new URL(source,document.baseURI);
    if(!['http:','https:'].includes(url.protocol))return source;
    url.searchParams.set('image-retry',String(attempt));
    return url.href;
  }
  const retryDelay=attempt=>300 * 2**(attempt-1);
  function displayImage(element,source) {
    let attempt=0;
    element.addEventListener('error',()=>{
      if(attempt>=2 || !element.isConnected)return;
      const next=++attempt;
      setTimeout(()=>{
        if(element.isConnected)element.setAttribute('href',imageAttemptURL(source,next));
      },retryDelay(next));
    });
    element.setAttribute('href',source);
  }

  function staticDrawing(panel,viewBox,detailView=manager.view) {
    const ns='http://www.w3.org/2000/svg';
    elevation=document.createElementNS(ns,'svg');elevation.id='cabinet-static-art';elevation.dataset.panel=panel;
    elevation.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
    elevation.setAttribute('role','img');elevation.setAttribute('aria-label',selected+'-inch cabinet, '+manager.view+' view');
    elevation.setAttribute('viewBox',viewBox.join(' '));
    function shape(type,attrs) {
      const element=document.createElementNS(ns,type);
      Object.entries(attrs).forEach(([k,v])=>element.setAttribute(k,v));elevation.append(element);return element;
    }
    function photo(name,x,y,w,h) {
      const image=shape('image',{x,y,width:w,height:h,preserveAspectRatio:'none'});
      displayImage(image,currentArt().images[name]);
    }
    if (panel!=='front') {
      photo(panel,0,0,panel==='left'||panel==='right'?12:selected,52);
      const detail=currentArt().details?.[detailView];
      if (detail && detail.face===panel) {
        const [x,y,width,height]=detail.rect;
        const image=shape('image',{x,y,width,height,preserveAspectRatio:'none'});
        if(!detail.parts)displayImage(image,detail.image);
        else detailURL(detail).then(url=>{
          if(image.isConnected)displayImage(image,url);
        }).catch(error=>console.warn('Cabinet detail image could not be loaded',error));
      }
    }
    else {
      shape('rect',{x:0,y:0,width:selected,height:52,fill:'#dddcd4'});
      shape('rect',{x:.5,y:0,width:selected-1,height:52,fill:'#eeede6'});
      photo('header',.5,0,selected-1,8);
      [8,14.5,26,37.5].forEach(z=>photo('lip',.5,z,selected-1,.5));
      photo('toe',.5,49,selected-1,3);
    }
    clipToShelf(elevation);
    poster.after(elevation);poster.hidden=true;paintFlatInk();
  }

  function removeElevation() {
    if (elevation) {elevation.remove();elevation=null;}
  }
  function showPoster() {
    removeElevation();
    ink.hide();
    const requested=currentArt().details?.[manager.view];
    if (!staticMode && loaded===selected && (!requested || canvas.dataset.detailTexture===requested.image)) {
      poster.hidden=true;return;
    }
    const art=currentArt(),view=manager.view || 'overview';
    const still=art.posters || {};
    const brand={'rear-streax':'streax','rear-powders':'buds','rear-soft':'soft'}[view];

    const main=canvas.parentElement;
    poster.hidden=false;poster.classList.remove('header-preview');
    poster.style.cssText='';poster.dataset.cabinetWidth=String(selected);poster.dataset.view=view;
    let photo,ratio;
    if (!photo && view==='overview') photo=still.overview;
    if (!photo && view==='front') photo=still.front;
    if(view==='rear')return staticDrawing('rear',[0,0,selected,52],'serum');
    if (!photo && view==='overview') {photo=still.rear || art.images.rear;ratio=selected/52;}
    if (!photo && view==='header') {photo=art.images.header;ratio=selected/8;}
    if(view==='left'||view==='right')return staticDrawing(view,[0,0,12,52]);
    if (photo) {
      poster.src=photo;poster.alt=selected+'-inch Original Green cabinet · '+(viewSelect.selectedOptions[0]?.textContent || view);
      if (ratio) {
        const w=Math.min(main.clientWidth,main.clientHeight*ratio);
        Object.assign(poster.style,{width:w+'px',height:w/ratio+'px',margin:'auto',objectFit:'fill'});
      }
      paintFlatInk();
      return;
    }
    if (view==='front') return staticDrawing('front',[-.4,-1,selected+.8,54]);
    const rear=brand || (view==='serum'?'wowish':'');
    if (rear) {
      const ar=aspect(),pose=viewPose(view,selected,ar,art);
      const half=overviewHalf(selected,ar)/pose.zoom,halfW=half*ar;
      return staticDrawing('rear',[selected/2-pose.offsetX-halfW,52-pose.aim-half,2*halfW,2*half]);
    }
    const crop=art.details?.[view];
    if (crop && ['streax-colours','streax-serums','buds-powders','buds-teas','wowish-washes','wowish-oils','soft-sun','soft-shelf'].includes(view)) {
      const [x,y,w,h]=crop.rect;
      if (view==='soft-shelf') return staticDrawing(crop.face,[x-.05,y-.05,w+.1,h+.1],view);
      return staticDrawing(crop.face,[x-.1,y-.09,w+.2,h+.18],view);
    }
    const left=view==='streax'||view==='skincare';
    staticDrawing(left?'left':'right',[-.15,view==='streax'||view==='buds'?3.4:27.05,12.3,24.4]);
  }

  function chooseView(name,immediate=false) {
    setWowishDownload(name);
    manager.view=name;manager.spinning=false;
    if (renderer) renderer.view(name,immediate);
    viewSelect.value=name;canvas.dataset.view=name;
    showPoster();if(staticMode)flatZoom.reset();
  }
  let cameraAddress=widthFromURL(location.href)+'/'+location.hash;
  function updateURL(width,view) {
    const url=new URL(location.href);url.searchParams.set('size',width);
    if (view!==undefined) url.hash=hashFor[view] || '';
    if (url.href!==location.href) history.pushState(null,'',url);
    cameraAddress=width+'/'+url.hash;
  }
  function fallback() {
    staticMode=true;loaded=0;manager.spinning=false;manager.current=null;
    spinButton.disabled=true;spinButton.textContent='Rotate';spinButton.setAttribute('aria-pressed','false');
    delete canvas.dataset.renderedWidth;delete canvas.dataset.rearTexture;
    canvas.hidden=true;statusNote.hidden=true;
    document.body.classList.remove('viewer-ready');document.body.classList.add('unavailable');
    const a=document.querySelector('#fallback-film');
    if(a){viewSelect.parentElement.append(a);a.hidden=!currentArt().film;}
    showPoster();flatZoom.reset();
  }
  function presentModel() {
    canvas.hidden=false;poster.hidden=true;statusNote.hidden=true;
    // The serum elevation is already displaying the exact crop while the GPU uploads it.
    if(!currentArt().details?.[manager.view] || canvas.dataset.detailTexture===currentArt().details[manager.view].image)removeElevation();
    const film=document.querySelector('#fallback-film');if(film)film.hidden=true;
    canvas.dataset.renderedWidth=String(loaded);canvas.dataset.rearTexture=currentArt().images.rear;
    document.body.classList.remove('unavailable');document.body.classList.add('viewer-ready');
    renderer.view(manager.view||'overview',true);renderer.render();
  }
  async function changeSize(value) {
    selected=value;const token=++epoch;
    uiSize();showPoster();
    if (!renderer || renderer.contextLost()) {fallback();return;}
    if (selected===loaded && !staticMode) {
      presentModel();
      return;
    }
    manager.current=null;manager.spinning=false;
    document.body.classList.remove('viewer-ready','unavailable');
    canvas.hidden=true;statusNote.hidden=false;statusNote.textContent='Loading '+selected+'″ cabinet…';
    const fallbackFilm=document.querySelector('#fallback-film');if(fallbackFilm)fallbackFilm.hidden=true;
    try {
      const didLoad=await renderer.load(selected,currentArt().images,()=>token===epoch);
      if (!didLoad || token!==epoch) return;
      loaded=selected;staticMode=false;
      presentModel();
    } catch(error) {if(token===epoch){console.error(error);fallback();}}
  }
  for (const input of radios) input.addEventListener('change',()=>{
    if (!input.checked) return;
    if (!manager.view) manager.view='overview';
    updateURL(Number(input.value),manager.view);
    changeSize(Number(input.value));
  });
  viewSelect.addEventListener('change',()=>{updateURL(selected,viewSelect.value);chooseView(viewSelect.value);});
  function followLocation() {
    const width=widthFromURL(location.href),view=links[location.hash]||'overview';
    if(cameraAddress===width+'/'+location.hash)return;
    cameraAddress=width+'/'+location.hash;
    if (width!==selected) {manager.view=view;viewSelect.value=view;changeSize(width);}
    else if (manager.view!==view) chooseView(view,true);
  }
  window.addEventListener('popstate',followLocation);window.addEventListener('hashchange',followLocation);
  wide.addEventListener('change',showPoster);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();++epoch;fallback();});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  new ResizeObserver(()=>{if (renderer && loaded===selected) {
    renderer.resize();
  } else showPoster();}).observe(canvas.parentElement);

  function createRenderer(gl) {
    const vertex=`attribute vec3 pos;attribute vec3 norm;attribute vec2 uv;
      uniform vec3 right,up,eye,target;uniform vec2 frame;varying vec2 tex;varying vec3 normal,point;
      void main(){vec3 p=pos-target;gl_Position=vec4(dot(p,right)/frame.x,dot(p,up)/frame.y,-dot(p,eye)/150.,1.);tex=uv;normal=norm;point=pos;}`;
    const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision?'highp':'mediump';
    const fragment=`precision ${precision} float;varying vec2 tex;varying vec3 normal,point;
      uniform sampler2D sheet,detailSheet,serumSheet;uniform vec4 detailRect,serumRect;uniform float kind,halfWidth;
      vec3 patchColor(vec3 base,sampler2D image,vec4 rect){
        if(rect.z<=0.0)return base;
        vec2 uv=(tex-rect.xy)/rect.zw;
        // Sample on both sides of the boundary so mip filters have valid derivatives.
        vec3 detailColor=texture2D(image,uv).rgb;
        vec2 edge=min(uv,vec2(1.0)-uv);
        return mix(base,detailColor,smoothstep(.001,.002,min(edge.x,edge.y)));
      }
      void main(){
        if(kind>2.5){vec2 f=vec2((point.x-1.)/(halfWidth+3.),(point.y-1.)/8.);gl_FragColor=vec4(.25,.24,.19,.20*exp(-1.5*dot(f,f)));return;}
        if(kind>1.5){
          vec3 color=texture2D(sheet,tex).rgb;
          color=patchColor(color,detailSheet,detailRect);
          color=patchColor(color,serumSheet,serumRect);
          gl_FragColor=vec4(color*(.985+.015*max(normal.z,0.)),1.);return;
        }
        float lit=.79+.15*max(0.,dot(normal,normalize(vec3(-.6,-.6,1.))))+.045*normal.z;
        float depth=clamp((point.y+6.)/12.,0.,1.),side=clamp((abs(point.x)-halfWidth+4.)/4.,0.,1.);
        float inner=step(point.y,5.85)*step(abs(point.x),halfWidth-.48)*step(3.,point.z);
        float occlude=inner*(.075*depth+.025*side);
        if(normal.y < -.8 && point.y > 5.){float b=min(min(abs(point.z-14.5),abs(point.z-26.)),min(abs(point.z-37.5),abs(point.z-44.)));occlude+=.06*exp(-.65*b);}
        gl_FragColor=vec4(vec3(.969,.963,.940)*(lit-occlude),1.);
      }`;
    const webgl2=typeof WebGL2RenderingContext!=='undefined' && gl instanceof WebGL2RenderingContext;
    const program=gl.createProgram();
    for (const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);
      let source=code;
      if(webgl2){
        const vertexStage=type===gl.VERTEX_SHADER;
        source='#version 300 es\n'+code.replace(/\battribute\b/g,'in')
          .replace(/\bvarying\b/g,vertexStage?'out':'in').replace(/texture2D\(/g,'texture(');
        if(!vertexStage)source=source.replace('float;','float;out vec4 outColor;').replace(/gl_FragColor/g,'outColor');
      }
      gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const u=Object.fromEntries(['right','up','eye','target','frame','sheet','detailSheet','detailRect','serumSheet','serumRect','kind','halfWidth'].map(n=>[n,gl.getUniformLocation(program,n)]));
    const attrs=[['pos',3,0],['norm',3,12],['uv',2,24]].map(([key,n,o])=>[gl.getAttribLocation(program,key),n,o]);
    attrs.forEach(([a])=>gl.enableVertexAttribArray(a));
    gl.uniform1i(u.sheet,0);gl.uniform1i(u.detailSheet,1);gl.uniform1i(u.serumSheet,2);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    const maximum=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const af=gl.getExtension('EXT_texture_filter_anisotropic');
    const maxAniso=af?Math.min(8,gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):0;
    const viewportLimits=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const renderbufferLimit=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    let model=null,objects=new Map(),frame=0,last=0,labelHeldAt=0;
    // A named close-up and a manual camera zoom may cover different regions on the same face.
    function detailLayer(datasetKey) {
      let requested=null,active=null,revision=0;
      return {
        get active(){return active;},
        get source(){return requested;},
        set(next){
          if(next===requested)return;
          requested=next;const token=++revision;
          if(active){gl.deleteTexture(active.texture);active=null;}
          delete canvas.dataset[datasetKey];
          if(!next)return;
          const width=selected;
          const current=()=>token===revision && selected===width && model?.width===width;
          detailURL(next).then(url=>current()?fetchTexture(url,current):null).then(texture=>{
            if(!texture)return;
            if(!current()){gl.deleteTexture(texture);return;}
            const [x,y,w,h]=next.rect,faceWidth=next.face==='rear'?width:12;
            active={texture,face:next.face,rect:[x/faceWidth,1-(y+h)/52,w/faceWidth,h/52]};
            canvas.dataset[datasetKey]=next.image;
            invalidate();
            if(datasetKey==='detailTexture' && currentArt().details?.[manager.view]===next && !staticMode && loaded===width)
              requestAnimationFrame(()=>{if(current() && currentArt().details?.[manager.view]===next)removeElevation();});
          }).catch(error=>{if(current())console.warn('Cabinet detail image could not be loaded',error);});
        }
      };
    }
    const namedDetail=detailLayer('detailTexture'),manualSerum=detailLayer('serumTexture');
    function useDetail(view){namedDetail.set(currentArt().details?.[view]||null);}
    async function fetchTexture(url,current) {
      let im;
      for(let attempt=0;attempt<3;attempt++){
        if(attempt)await new Promise(done=>setTimeout(done,retryDelay(attempt)));
        if(!current())return null;
        im=new Image();im.src=imageAttemptURL(url,attempt);
        try {await im.decode();break;}
        catch(error){if(attempt===2)throw error;}
      }
      if(!current())return null;
      let bitmap=im;
      if(Math.max(im.width,im.height)>maximum) {
        bitmap=document.createElement('canvas');const factor=maximum/Math.max(im.width,im.height);
        bitmap.width=Math.max(1,Math.round(im.width*factor));bitmap.height=Math.max(1,Math.round(im.height*factor));
        bitmap.getContext('2d').drawImage(im,0,0,bitmap.width,bitmap.height);
      }
      const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const pot=x=>(x&(x-1))===0;
      if(webgl2 || (pot(bitmap.width)&&pot(bitmap.height))){
        gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      }else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      if(af)gl.texParameterf(gl.TEXTURE_2D,af.TEXTURE_MAX_ANISOTROPY_EXT,maxAniso);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      return t;
    }
    async function load(width,urls,current) {
      useDetail('');manualSerum.set(null);
      // Keep shared faces resident and release the old-width GPU resources on commit.
      // A superseded or failed load cannot install mixed-width artwork.
      const entries=new Map(),fresh=new Set();
      const jobs=await Promise.allSettled([...new Set(faces.map(k=>urls[k]))].map(async url=>{
        if (!url)throw Error('Missing panel texture');
        const cached=objects.get(url);
        const tex=cached||await fetchTexture(url,current);
        if(tex){entries.set(url,tex);if(!cached)fresh.add(tex);}
      }));
      const failure=jobs.find(j=>j.status==='rejected');
      if(!current()||failure){fresh.forEach(t=>gl.deleteTexture(t));if(failure&&current())throw failure.reason;return false;}
      const data=cabinetGeometry(width),buffers={};
      Object.entries(data).forEach(([key,values])=>{
        const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);buffers[key]=[b,values.length/8];
      });
      if(model)Object.values(model.buffers).forEach(([b])=>gl.deleteBuffer(b));
      objects.forEach((t,url)=>{if(!entries.has(url))gl.deleteTexture(t);});
      objects=entries;model={width,buffers,textures:Object.fromEntries(faces.map(k=>[k,entries.get(urls[k])]))};
      return true;
    }
    function draw(key,kind){
      const [buffer,n]=model.buffers[key];gl.uniform1f(u.kind,kind);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      attrs.forEach(([a,k,o])=>gl.vertexAttribPointer(a,k,gl.FLOAT,false,32,o));
      const base=model.textures[key]||model.textures.lip;
      const overlay=namedDetail.active?.face===key?namedDetail.active:null;
      const serum=manualSerum.active?.face===key?manualSerum.active:null;
      gl.uniform4fv(u.serumRect,serum?serum.rect:[0,0,0,0]);
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,serum?serum.texture:base);
      gl.uniform4fv(u.detailRect,overlay?overlay.rect:[0,0,0,0]);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,overlay?overlay.texture:base);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,base);
      gl.drawArrays(gl.TRIANGLES,0,n);
    }
    function drawFrame(t) {
      frame=0;if(!model||canvas.hidden||document.hidden||labels.isOpen())return;
      const dt=last?Math.min((t-last)/1000,.15):0;last=t;const m=manager;
      const transitioning=Boolean(m.current);
      if(m.current) {
        const step=clamp((t-m.current.start)/m.current.time,0,1),s=step*step*(3-2*step);
        for(const k of ['yaw','pitch','zoom','aim','offsetX','offsetY'])m[k]=m.current.a[k]+(m.current.b[k]-m.current.a[k])*s;
        if(step===1)m.current=null;
      }
      if(m.spinning&&!transitioning)m.yaw+=dt*orbitSpeed;
      clipToShelf(canvas);
      // Match the physical display up to a 4096px artwork edge and the GPU's framebuffer limit.
      const dpr=Math.min(window.devicePixelRatio||1,
        Math.min(4096,viewportLimits[0],renderbufferLimit)/Math.max(1,canvas.clientWidth),
        Math.min(4096,viewportLimits[1],renderbufferLimit)/Math.max(1,canvas.clientHeight));
      const w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(!w||!h)return;
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const a=radians(m.yaw),p=radians(m.pitch),ca=Math.cos(a),sa=Math.sin(a),cp=Math.cos(p),sp=Math.sin(p);
      const ar=w/h;
      const serum=currentArt().details?.serum;
      // Retain the high-resolution product patch through free drags and zooms from any starting view.
      // Release it on returning to an overview-scale frame or changing to a named product group.
      if(model.width===selected) {
        const details=currentArt().details;
        const face=Math.abs(sa)>.76 ? (sa>0?'right':'left') : ca<-.15?'rear':null;
        const isShelf=Boolean(details[m.view]);
        const top=52-m.aim;
        if(!isShelf && m.zoom>=1.075 && face) {
          // Keep the nearest shelf at native detail after a drag or a zoom from the full panel.
          // Rank whole-cabinet stations by their centers, preferring tight shelf crops on the sides.
          const candidates=Object.entries(details).filter(([id,d])=>d.face===face &&
            (face==='rear'||!['streax','buds','skincare','soft'].includes(id)));
          candidates.sort((a,b)=>Math.abs(top-a[1].rect[1]-a[1].rect[3]/2)-Math.abs(top-b[1].rect[1]-b[1].rect[3]/2));
          const nearest=candidates[0]?.[1];
          if(!m.view && namedDetail.source?.face===face) {
            // Selecting a shelf then zooming into its labels should retain that shelf's exact crop.
            if(['streax','buds','skincare','soft'].some(id=>details[id]===namedDetail.source) && nearest)
              namedDetail.set(nearest);
          } else if(nearest)namedDetail.set(nearest);
          const second=face==='rear' && namedDetail.source!==serum?serum:candidates.find(c=>c[1]!==namedDetail.source)?.[1];
          manualSerum.set(second||null);
        } else {
          manualSerum.set(null);
          if(!isShelf)namedDetail.set(null);
        }
      }
      let half=overviewHalf(model.width,ar)/m.zoom;
      if(m.view==='left'||m.view==='right'){
        // Keep the whole cabinet in a narrow portrait frame as its wide face turns into view.
        const projectedWidth=Math.abs(ca)*model.width+Math.abs(sa)*12;
        half=Math.max(half,(projectedWidth/2+.45)/ar);
      }
      gl.uniform3f(u.right,ca,sa,0);gl.uniform3f(u.up,-sa*sp,ca*sp,cp);gl.uniform3f(u.eye,sa*cp,-ca*cp,sp);
      gl.uniform3f(u.target,m.offsetX,m.offsetY,m.aim);gl.uniform2f(u.frame,half*ar,half);gl.uniform1f(u.halfWidth,model.width/2);
      gl.depthMask(false);draw('floor',3);gl.depthMask(true);draw('boards',1);faces.forEach(k=>draw(k,2));
      const cameraFrame={width:2*half*ar,height:2*half,targetX:m.offsetX,targetY:m.offsetY,targetZ:m.aim,yaw:m.yaw,pitch:m.pitch};
      canvas.dataset.frameInches=JSON.stringify(cameraFrame);
      if(elevation || !poster.hidden)paintFlatInk();
      else ink.model(model.width,cameraFrame,canvas,canvas.getBoundingClientRect());
      if(m.spinning||m.current)invalidate();
    }
    function invalidate(){if(!frame&&!document.hidden)frame=requestAnimationFrame(drawFrame);}
    function render(){
      if(frame)cancelAnimationFrame(frame);
      drawFrame(performance.now());
    }
    let hiddenAt=0;
    document.addEventListener('visibilitychange',()=>{
      last=0;
      if(document.hidden){
        hiddenAt=performance.now();
        if(frame)cancelAnimationFrame(frame);
        frame=0;
      }else{
        if(hiddenAt && manager.current)manager.current.start+=performance.now()-Math.max(hiddenAt,manager.current.start);
        hiddenAt=0;invalidate();
      }
    });
    function holdLabels(open){
      if(open){labelHeldAt=performance.now();return;}
      if(labelHeldAt && manager.current)manager.current.start+=performance.now()-Math.max(labelHeldAt,manager.current.start);
      labelHeldAt=0;last=0;invalidate();
    }
    function canRotate(){return orbitViews.has(manager.view)||!manager.view;}
    function applyRotation(){
      manager.spinning=canRotate()&&(rotationChoice??!reduced.matches);
      last=0;
    }
    reduced.addEventListener('change',()=>{
      if(staticMode||canvas.hidden)return;
      if(reduced.matches && manager.current){Object.assign(manager,manager.current.b);manager.current=null;}
      applyRotation();update();
    });
    function update(){
      viewSelect.value=manager.view;canvas.dataset.view=manager.view||'custom';
      spinButton.disabled=!canRotate();spinButton.textContent=manager.spinning?'Pause':'Rotate';
      spinButton.setAttribute('aria-pressed',String(manager.spinning));
      spinButton.title=spinButton.disabled?'Rotation is available in full-cabinet views':(manager.spinning?'Pause cabinet rotation':'Rotate the cabinet');
      plus.disabled=manager.zoom>=47.999;minus.disabled=manager.zoom<=.681;invalidate();
    }
    function stop(){removeElevation();rotationChoice=false;manager.current=null;manager.spinning=false;manager.view='';last=0;update();}
    function view(name,immediate=false) {
      if(!name){update();return;}
      manager.view=name;useDetail(name);applyRotation();
      const dest=viewPose(name,selected,aspect(),currentArt());
      dest.yaw=manager.yaw+((dest.yaw-manager.yaw)%360+540)%360-180;
      if(immediate||reduced.matches){manager.current=null;Object.assign(manager,dest);}
      else manager.current={a:{...manager},b:dest,start:performance.now(),time:420};
      update();
    }
    function resize(){
      if(manager.view && !manager.current){
        const next=viewPose(manager.view,selected,aspect(),currentArt());
        Object.assign(manager,{zoom:next.zoom,aim:next.aim,offsetX:next.offsetX,offsetY:next.offsetY});
      }
      invalidate();
    }
    function zoom(f,from=null,to=from){
      if(staticMode || !model)return;
      const r=canvas.getBoundingClientRect();
      const base=overviewHalf(model.width,aspect());
      let oldHeight=2*base/manager.zoom;
      if(manager.view==='left' || manager.view==='right'){
        const yaw=radians(manager.yaw);
        oldHeight=Math.max(oldHeight,(Math.abs(Math.cos(yaw))*model.width+Math.abs(Math.sin(yaw))*12+.9)/aspect());
      }
      const oldZoom=2*base/oldHeight;
      const next=clamp(oldZoom*f,.68,48);
      if(from && r.height){
        const px=(from.x-r.left-r.width/2)*oldHeight/r.height-(to.x-r.left-r.width/2)*oldHeight*oldZoom/next/r.height;
        const py=(r.top+r.height/2-from.y)*oldHeight/r.height-(r.top+r.height/2-to.y)*oldHeight*oldZoom/next/r.height;
        const a=radians(manager.yaw), p=radians(manager.pitch);
        manager.offsetX+=px*Math.cos(a)-py*Math.sin(a)*Math.sin(p);
        manager.offsetY+=px*Math.sin(a)+py*Math.cos(a)*Math.sin(p);
        manager.aim+=py*Math.cos(p);
      }
      stop();manager.zoom=next;update();
    }
    spinButton.onclick=()=>{
      if(!canRotate())return;
      rotationChoice=!manager.spinning;
      if(manager.current){Object.assign(manager,manager.current.b);manager.current=null;}
      applyRotation();update();
    };
    plus.onclick=()=>zoom(1.2);minus.onclick=()=>zoom(1/1.2);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-150,150)*.0018),{x:e.clientX,y:e.clientY});},{passive:false});
    const points=new Map();
    function pinch(){const [a,b]=points.values();return {span:Math.hypot(a.x-b.x,a.y-b.y),mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};}
    canvas.onpointerdown=e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);if(!tapped)stop();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2)tapped=null;};
    canvas.onpointermove=e=>{
      const old=points.get(e.pointerId);if(!old || tapped)return;
      if(manager.view || manager.spinning || manager.current)stop();
      const previous=points.size===2?pinch():null;
      points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(previous){const next=pinch();if(previous.span>0 && next.span>0)zoom(next.span/previous.span,previous.mid,next.mid);}
      else if(points.size===1){manager.yaw-=(e.clientX-old.x)*.4;manager.pitch=clamp(manager.pitch+(e.clientY-old.y)*.28,1,62);}
      update();
    };
    canvas.onpointerup=canvas.onpointercancel=e=>{points.delete(e.pointerId);};
    canvas.onkeydown=e=>{
      if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        stop();if(e.key==='ArrowLeft')manager.yaw+=8;if(e.key==='ArrowRight')manager.yaw-=8;
        if(e.key==='ArrowUp')manager.pitch=clamp(manager.pitch+4,1,62);if(e.key==='ArrowDown')manager.pitch=clamp(manager.pitch-4,1,62);update();
      }else return;e.preventDefault();
    };
    // Film renderer injection point.
    return {load,view,render,resize,invalidate,holdLabels,contextLost:()=>gl.isContextLost()};
  }

  viewSelect.value=manager.view;canvas.dataset.view=manager.view;
  try {
    const options={alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false};
    const gl=canvas.getContext('webgl2',options) || canvas.getContext('webgl',options);
    if(gl)renderer=createRenderer(gl);
  } catch(error) {console.error(error);}
  changeSize(selected);
}
if (typeof document !== 'undefined') startViewer();
else if (typeof module !== 'undefined') module.exports={cabinetGeometry,viewPose,overviewHalf,widthFromURL,links};
