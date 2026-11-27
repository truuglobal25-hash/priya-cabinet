'use strict';

const sizes = [18, 24, 36];
const faces = ['rear', 'left', 'right', 'header', 'lip', 'toe'];
const links = {
  '#overview':'overview', '#front':'front', '#rear':'rear', '#left':'left', '#right':'right',
  '#header':'header', '#rear-streax':'rear-streax', '#rear-powders':'rear-powders',
  '#face-serums':'serum', '#streax':'streax', '#hair-serums':'streax',
  '#buds-roots':'buds', '#wowish-skincare':'skincare', '#soft-touch':'soft'
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
    yaw,pitch,aim,offsetX:0,zoom:base/Math.max(halfHeight,halfWidth/aspect)
  });
  const rearBrand={'rear-streax':'streax','rear-powders':'buds',serum:'wowish'}[name];
  if (rearBrand) {
    const [x,y,w,h]=art.stations[rearBrand];
    const caption=art.captions?.[rearBrand] || [0,width];
    // Portrait framing contains the whole group. Wider screens also admit its printed caption.
    const include=clamp((aspect-.76)/.58,0,1);
    const l=x+include*(Math.min(x,caption[0])-x);
    const r=x+w+include*(Math.max(x+w,caption[1])-(x+w));
    const pose=fixed(180,0,52-y-h/2,h/2+.34,(r-l)/2+.34);
    pose.offsetX=width/2-(l+r)/2;
    return pose;
  }
  if (name==='header') return fixed(0,0,48,4.34,width/2+.28);
  if (name==='left'||name==='right') return fixed(name==='left'?270:90,0,26,27.8,6.45);
  if (name==='streax'||name==='buds'||name==='skincare'||name==='soft') {
    return fixed(name==='streax'||name==='skincare'?270:90,0,
      {streax:36.4,buds:36.35,skincare:12.75,soft:12.75}[name],12.2,6.45);
  }
  const [yaw,pitch]={front:[-9,5],rear:[180,2],overview:[212,7]}[name] || [212,7];
  return {yaw,pitch,aim:26,offsetX:0,zoom:1};
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

  function uiSize() {
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
    artworkDownload.href = './green-cabinet/cabinet-' + selected + '-rear-4k.png?v=0f6d13fef423';
    artworkDownload.download = filename + '-Rear-4K.png';
    Object.assign(canvas.dataset,{cabinetWidth:String(selected),cabinetHeight:'52',cabinetDepth:'12'});
    document.dispatchEvent(new CustomEvent('cabinet-size-change',{bubbles:true,detail:{width:selected,depth:12,height:52}}));
  }

  function staticDrawing(panel,viewBox) {
    const ns='http://www.w3.org/2000/svg';
    elevation=document.createElementNS(ns,'svg');elevation.id='cabinet-static-art';
    elevation.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none';
    elevation.setAttribute('role','img');elevation.setAttribute('aria-label',selected+'-inch cabinet, '+manager.view+' view');
    elevation.setAttribute('viewBox',viewBox.join(' '));
    function shape(type,attrs) {
      const element=document.createElementNS(ns,type);
      Object.entries(attrs).forEach(([k,v])=>element.setAttribute(k,v));elevation.append(element);
    }
    function photo(name,x,y,w,h) {
      shape('image',{href:currentArt().images[name],x,y,width:w,height:h,preserveAspectRatio:'none'});
    }
    if (panel!=='front') photo(panel,0,0,panel==='left'||panel==='right'?12:selected,52);
    else {
      shape('rect',{x:0,y:0,width:selected,height:52,fill:'#dddcd4'});
      shape('rect',{x:.5,y:0,width:selected-1,height:52,fill:'#eeede6'});
      photo('header',.5,0,selected-1,8);
      [8,14.5,26,37.5].forEach(z=>photo('lip',.5,z,selected-1,.5));
      photo('toe',.5,49,selected-1,3);
    }
    poster.after(elevation);poster.hidden=true;
  }

  function showPoster() {
    if (elevation) {elevation.remove();elevation=null;}
    if (!staticMode && loaded===selected) {poster.hidden=true;return;}
    const art=currentArt(),view=manager.view || 'overview';
    const still=art.posters || {};
    const brand={'rear-streax':'streax','rear-powders':'buds'}[view];
    const close=brand && still[brand]?.[wide.matches?'wide':'portrait'];
    const main=canvas.parentElement;
    poster.hidden=false;poster.classList.remove('header-preview');
    poster.style.cssText='';poster.dataset.cabinetWidth=String(selected);poster.dataset.view=view;
    let photo=close,ratio;
    if (!photo && view==='overview') photo=still.overview;
    if (!photo && view==='front') photo=still.front;
    if (!photo && (view==='rear'||view==='overview')) {photo=still.rear || art.images.rear;ratio=selected/52;}
    if (!photo && view==='header') {photo=art.images.header;ratio=selected/8;}
    if (!photo && (view==='left'||view==='right')) {photo=art.images[view];ratio=12/52;}
    if (photo) {
      poster.src=photo;poster.alt=selected+'-inch Original Green cabinet · '+(viewSelect.selectedOptions[0]?.textContent || view);
      if (ratio) {
        const w=Math.min(main.clientWidth,main.clientHeight*ratio);
        Object.assign(poster.style,{width:w+'px',height:w/ratio+'px',margin:'auto',objectFit:'fill'});
      }
      return;
    }
    if (view==='front') return staticDrawing('front',[-.4,-1,selected+.8,54]);
    const rear=brand || (view==='serum'?'wowish':'');
    if (rear) {
      const [x,y,w,h]=art.stations[rear];return staticDrawing('rear',[x-.3,y-.3,w+.6,h+.6]);
    }
    const left=view==='streax'||view==='skincare';
    staticDrawing(left?'left':'right',[-.15,view==='streax'||view==='buds'?3.4:27.05,12.3,24.4]);
  }

  function chooseView(name,immediate=false) {
    manager.view=name;manager.spinning=false;
    if (renderer) renderer.view(name,immediate);
    viewSelect.value=name;canvas.dataset.view=name;
    showPoster();
  }
  function updateURL(width,view) {
    const url=new URL(location.href);url.searchParams.set('size',width);
    if (view!==undefined) url.hash=hashFor[view] || '';
    if (url.href!==location.href) history.pushState(null,'',url);
  }
  function fallback() {
    staticMode=true;loaded=0;manager.spinning=false;manager.current=null;
    spinButton.disabled=true;spinButton.textContent='Rotate';spinButton.setAttribute('aria-pressed','false');
    delete canvas.dataset.renderedWidth;delete canvas.dataset.rearTexture;
    canvas.hidden=true;statusNote.hidden=true;
    document.body.classList.remove('viewer-ready');document.body.classList.add('unavailable');
    const a=document.querySelector('#fallback-film');if(a) a.hidden=!currentArt().film;
    showPoster();
  }
  function presentModel() {
    canvas.hidden=false;poster.hidden=true;statusNote.hidden=true;
    if(elevation){elevation.remove();elevation=null;}
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
      uniform sampler2D sheet;uniform float kind,halfWidth;
      void main(){
        if(kind>2.5){vec2 f=vec2((point.x-1.)/(halfWidth+3.),(point.y-1.)/8.);gl_FragColor=vec4(.25,.24,.19,.20*exp(-1.5*dot(f,f)));return;}
        if(kind>1.5){gl_FragColor=vec4(texture2D(sheet,tex).rgb*(.985+.015*max(normal.z,0.)),1.);return;}
        float lit=.79+.15*max(0.,dot(normal,normalize(vec3(-.6,-.6,1.))))+.045*normal.z;
        float depth=clamp((point.y+6.)/12.,0.,1.),side=clamp((abs(point.x)-halfWidth+4.)/4.,0.,1.);
        float inner=step(point.y,5.85)*step(abs(point.x),halfWidth-.48)*step(3.,point.z);
        float occlude=inner*(.075*depth+.025*side);
        if(normal.y < -.8 && point.y > 5.){float b=min(min(abs(point.z-14.5),abs(point.z-26.)),min(abs(point.z-37.5),abs(point.z-44.)));occlude+=.06*exp(-.65*b);}
        gl_FragColor=vec4(vec3(.969,.963,.940)*(lit-occlude),1.);
      }`;
    const program=gl.createProgram();
    for (const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);gl.deleteShader(shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const u=Object.fromEntries(['right','up','eye','target','frame','sheet','kind','halfWidth'].map(n=>[n,gl.getUniformLocation(program,n)]));
    const attrs=[['pos',3,0],['norm',3,12],['uv',2,24]].map(([key,n,o])=>[gl.getAttribLocation(program,key),n,o]);
    attrs.forEach(([a])=>gl.enableVertexAttribArray(a));
    gl.uniform1i(u.sheet,0);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
    const maximum=gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const af=gl.getExtension('EXT_texture_filter_anisotropic');
    const maxAniso=af?Math.min(8,gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):0;
    let model=null,objects=new Map(),frame=0,last=0;
    async function fetchTexture(url,current) {
      const im=new Image();im.src=url;await im.decode();if(!current())return null;
      let bitmap=im;
      if(Math.max(im.width,im.height)>maximum) {
        bitmap=document.createElement('canvas');const factor=maximum/Math.max(im.width,im.height);
        bitmap.width=Math.max(1,Math.round(im.width*factor));bitmap.height=Math.max(1,Math.round(im.height*factor));
        bitmap.getContext('2d').drawImage(im,0,0,bitmap.width,bitmap.height);
      }
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,bitmap);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const pot=x=>(x&(x-1))===0;
      if(pot(bitmap.width)&&pot(bitmap.height)){
        gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      }else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      if(af)gl.texParameterf(gl.TEXTURE_2D,af.TEXTURE_MAX_ANISOTROPY_EXT,maxAniso);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      return t;
    }
    async function load(width,urls,current) {
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
      gl.bindTexture(gl.TEXTURE_2D,model.textures[key]||model.textures.lip);
      gl.drawArrays(gl.TRIANGLES,0,n);
    }
    function drawFrame(t) {
      frame=0;if(!model||canvas.hidden||document.hidden)return;
      const dt=last?Math.min((t-last)/1000,.15):0;last=t;const m=manager;
      const transitioning=Boolean(m.current);
      if(m.current) {
        const step=clamp((t-m.current.start)/m.current.time,0,1),s=step*step*(3-2*step);
        for(const k of ['yaw','pitch','zoom','aim','offsetX'])m[k]=m.current.a[k]+(m.current.b[k]-m.current.a[k])*s;
        if(step===1)m.current=null;
      }
      if(m.spinning&&!transitioning)m.yaw+=dt*orbitSpeed;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(!w||!h)return;
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const a=radians(m.yaw),p=radians(m.pitch),ca=Math.cos(a),sa=Math.sin(a),cp=Math.cos(p),sp=Math.sin(p);
      const ar=w/h;
      let half=overviewHalf(model.width,ar)/m.zoom;
      if(m.view==='left'||m.view==='right'){
        // Keep the whole cabinet in a narrow portrait frame as its wide face turns into view.
        const projectedWidth=Math.abs(ca)*model.width+Math.abs(sa)*12;
        half=Math.max(half,(projectedWidth/2+.45)/ar);
      }
      gl.uniform3f(u.right,ca,sa,0);gl.uniform3f(u.up,-sa*sp,ca*sp,cp);gl.uniform3f(u.eye,sa*cp,-ca*cp,sp);
      gl.uniform3f(u.target,m.offsetX,0,m.aim);gl.uniform2f(u.frame,half*ar,half);gl.uniform1f(u.halfWidth,model.width/2);
      gl.depthMask(false);draw('floor',3);gl.depthMask(true);draw('boards',1);faces.forEach(k=>draw(k,2));
      canvas.dataset.frameInches=JSON.stringify({width:2*half*ar,height:2*half,targetX:m.offsetX,targetZ:m.aim,yaw:m.yaw,pitch:m.pitch});
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
      plus.disabled=manager.zoom>=4.999;minus.disabled=manager.zoom<=.681;invalidate();
    }
    function stop(){rotationChoice=false;manager.current=null;manager.spinning=false;manager.view='';last=0;update();}
    function view(name,immediate=false) {
      if(!name){update();return;}
      manager.view=name;applyRotation();
      const dest=viewPose(name,selected,aspect(),currentArt());
      dest.yaw=manager.yaw+((dest.yaw-manager.yaw)%360+540)%360-180;
      if(immediate||reduced.matches){manager.current=null;Object.assign(manager,dest);}
      else manager.current={a:{...manager},b:dest,start:performance.now(),time:420};
      update();
    }
    function resize(){
      if(manager.view && !manager.current){
        const next=viewPose(manager.view,selected,aspect(),currentArt());
        Object.assign(manager,{zoom:next.zoom,aim:next.aim,offsetX:next.offsetX});
      }
      invalidate();
    }
    function zoom(f){stop();manager.zoom=clamp(manager.zoom*f,.68,5);update();}
    spinButton.onclick=()=>{
      if(!canRotate())return;
      rotationChoice=!manager.spinning;
      if(manager.current){Object.assign(manager,manager.current.b);manager.current=null;}
      applyRotation();update();
    };
    plus.onclick=()=>zoom(1.2);minus.onclick=()=>zoom(1/1.2);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-clamp(e.deltaY,-150,150)*.0018));},{passive:false});
    const points=new Map();let span=0;
    function gap(){const [a,b]=points.values();return Math.hypot(a.x-b.x,a.y-b.y);}
    canvas.onpointerdown=e=>{canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);stop();points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2)span=gap();};
    canvas.onpointermove=e=>{
      const old=points.get(e.pointerId);if(!old)return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(points.size===2){const next=gap();if(span>0&&next>0)manager.zoom=clamp(manager.zoom*next/span,.68,5);span=next;}
      else if(points.size===1){manager.yaw-=(e.clientX-old.x)*.4;manager.pitch=clamp(manager.pitch+(e.clientY-old.y)*.28,1,62);}
      update();
    };
    canvas.onpointerup=canvas.onpointercancel=e=>{points.delete(e.pointerId);span=0;};
    canvas.onkeydown=e=>{
      if(e.key==='+'||e.key==='=')zoom(1.2);else if(e.key==='-')zoom(1/1.2);
      else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
        stop();if(e.key==='ArrowLeft')manager.yaw+=8;if(e.key==='ArrowRight')manager.yaw-=8;
        if(e.key==='ArrowUp')manager.pitch=clamp(manager.pitch+4,1,62);if(e.key==='ArrowDown')manager.pitch=clamp(manager.pitch-4,1,62);update();
      }else return;e.preventDefault();
    };
    // Film renderer injection point.
    return {load,view,render,resize,invalidate,contextLost:()=>gl.isContextLost()};
  }

  viewSelect.value=manager.view;canvas.dataset.view=manager.view;
  try {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if(gl)renderer=createRenderer(gl);
  } catch(error) {console.error(error);}
  changeSize(selected);
}
if (typeof document !== 'undefined') startViewer();
else if (typeof module !== 'undefined') module.exports={cabinetGeometry,viewPose,overviewHalf,widthFromURL,links};
