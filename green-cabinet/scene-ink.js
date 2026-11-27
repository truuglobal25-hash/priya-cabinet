'use strict';

// Orthographic cabinet faces are planar, so the screen projection of their print
// coordinates is affine even while orbiting. Use the same edge insets as the mesh.
function cabinetInkTransforms(width, frame, screen) {
  const a = frame.yaw * Math.PI / 180, p = frame.pitch * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
  const kx = screen.width / frame.width, ky = screen.height / frame.height;
  const inset = .017, half = width / 2;
  function project(x, y, z) {
    x -= frame.targetX; y -= frame.targetY || 0; z -= frame.targetZ;
    return [screen.x + screen.width / 2 + kx * (x*ca + y*sa),
            screen.y + screen.height / 2 - ky * (-x*sa*sp + y*ca*sp + z*cp)];
  }
  function matrix(start, dx, dy) {
    const [x,y] = project(...start);
    const [u,v] = project(...start.map((n,i) => n + dx[i]));
    const [s,t] = project(...start.map((n,i) => n + dy[i]));
    return [u-x,v-y,s-x,t-y,x,y];
  }
  const vertical = [0,0,-(52 - 2*inset)/52], result = {};
  if (-ca*cp > .015)
    result.rear = matrix([half-inset,6.007,52-inset],[-(width-2*inset)/width,0,0],vertical);
  if (-sa*cp > .015)
    result.left = matrix([-half-.007,6-inset,52-inset],[0,-(12-2*inset)/12,0],vertical);
  if (sa*cp > .015)
    result.right = matrix([half+.007,-6+inset,52-inset],[0,(12-2*inset)/12,0],vertical);
  return result;
}

function createCabinetInk(main, canvas) {
  const ns = 'http://www.w3.org/2000/svg';
  const layer = document.createElementNS(ns, 'svg');
  layer.id = 'cabinet-label-ink';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;overflow:hidden;pointer-events:none';
  canvas.after(layer);
  const showing = new Map();

  function paint(width, transforms, surface) {
    const needed = new Set(), sw = main.clientWidth, sh = main.clientHeight;
    const sets = window.cabinetInks?.[width] || {};
    const dpr = window.devicePixelRatio || 1;
    for (const [face, matrix] of Object.entries(transforms)) {
      const [a,b,c,d,e,f] = matrix;
      for (const item of sets[face] || []) {
        const [x,y,w,h] = item.rect, u = a*x + c*y + e, v = b*x + d*y + f;
        const ux = a*w, uy = b*w, vx = c*h, vy = d*h;
        const left = u + Math.min(0,ux) + Math.min(0,vx), top = v + Math.min(0,uy) + Math.min(0,vy);
        const right = u + Math.max(0,ux) + Math.max(0,vx), bottom = v + Math.max(0,uy) + Math.max(0,vy);
        if (right < 0 || bottom < 0 || left > sw || top > sh) continue;
        const horizontal = Math.hypot(ux,uy), vertical = Math.hypot(vx,vy);
        // At overview scale the native panel texture already resolves the packaging.
        // Exclude nearly edge-on labels even when the cabinet fills the screen.
        if (horizontal * dpr < 36 || vertical * dpr < 24 || Math.abs(ux*vy-uy*vx) * dpr*dpr < 6500) continue;
        const key = face + ':' + item.src + ':' + x + ',' + y;
        needed.add(key);
        let image = showing.get(key);
        if (!image) {
          image = document.createElementNS(ns,'image');
          image.setAttribute('preserveAspectRatio','none');
          image.setAttribute('href',item.src);
          layer.append(image);
          showing.set(key,image);
        }
        // Specify the SVG image viewport at display resolution. Only rotation and
        // foreshortening remain in the transform, including on high-DPI screens.
        const iw = Math.max(1,Math.ceil(horizontal)), ih = Math.max(1,Math.ceil(vertical));
        const t = 'matrix(' + [ux/iw,uy/iw,vx/ih,vy/ih,u,v].join(' ') + ')';
        image.setAttribute('width',iw);
        image.setAttribute('height',ih);
        image.setAttribute('transform',t);
      }
    }
    for (const [key,image] of showing) {
      if (!needed.has(key)) { image.remove(); showing.delete(key); }
    }
    layer.style.clipPath = surface?.style.clipPath || '';
    // The artwork's material in the WebGL fragment shader is multiplied by .985.
    layer.style.filter = surface === canvas ? 'brightness(.985)' : '';
  }
  function hide() { paint(0,{},null); }
  function model(width, frame, surface, bounds) {
    const mainRect = main.getBoundingClientRect();
    const screen = {x:bounds.left-mainRect.left, y:bounds.top-mainRect.top,
                    width:bounds.width,height:bounds.height};
    paint(width,cabinetInkTransforms(width,frame,screen),surface);
  }
  function elevation(width, art) {
    const m = art.getScreenCTM();
    if (!m) return hide();
    const r = main.getBoundingClientRect();
    paint(width,{[art.dataset.panel]:[m.a,m.b,m.c,m.d,m.e-r.left,m.f-r.top]},art);
  }
  return {hide, model, elevation};
}
