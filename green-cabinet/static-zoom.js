'use strict';

// No-WebGL browsers use the same panel artwork and the same pointer-centered zoom.
function staticCabinetZoom(main, smaller, larger, enabled, display, redraw) {
  let scale=1, x=0, y=0;
  const pointers=new Map();
  function apply() {
    const art=display();
    if (!art) return;
    art.style.transform=scale===1?'':'translate('+x+'px,'+y+'px) scale('+scale+')';
    smaller.disabled=scale<=1;
    larger.disabled=scale>=24;
    redraw();
  }
  function reset() {
    x=0; y=0; scale=1; pointers.clear();
    if (enabled()) apply();
  }
  function change(f, oldPoint, newPoint=oldPoint) {
    const r=main.getBoundingClientRect(), next=Math.max(1,Math.min(24,scale*f));
    const ox=oldPoint.x-r.left-r.width/2, oy=oldPoint.y-r.top-r.height/2;
    x=newPoint.x-oldPoint.x+ox-(ox-x)*next/scale;
    y=newPoint.y-oldPoint.y+oy-(oy-y)*next/scale;
    scale=next;
    if(scale===1){x=0;y=0;}
    apply();
  }
  function center(){
    const r=main.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};
  }
  function pair(){
    const [a,b]=pointers.values();
    return {distance:Math.hypot(a.x-b.x,a.y-b.y),point:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
  smaller.addEventListener('click',()=>{if(enabled())change(1/1.3,center());});
  larger.addEventListener('click',()=>{if(enabled())change(1.3,center());});
  main.addEventListener('wheel',e=>{
    if(!enabled() || e.target.closest('a'))return;
    e.preventDefault();change(Math.exp(-Math.max(-150,Math.min(150,e.deltaY))*.002),{x:e.clientX,y:e.clientY});
  },{passive:false});
  main.addEventListener('pointerdown',e=>{
    if(!enabled() || e.target.closest('a'))return;
    main.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  });
  main.addEventListener('pointermove',e=>{
    if(!enabled() || !pointers.has(e.pointerId))return;
    const oldPoint=pointers.get(e.pointerId), old=pointers.size===2?pair():null;
    const nextPoint={x:e.clientX,y:e.clientY};
    pointers.set(e.pointerId,nextPoint);
    if(old){
      const next=pair();
      if(old.distance>0 && next.distance>0)change(next.distance/old.distance,old.point,next.point);
    } else if(pointers.size===1 && scale>1) change(1,oldPoint,nextPoint);
  });
  for(const type of ['pointercancel','pointerup','lostpointercapture'])
    main.addEventListener(type,e=>pointers.delete(e.pointerId));
  return {reset};
}
