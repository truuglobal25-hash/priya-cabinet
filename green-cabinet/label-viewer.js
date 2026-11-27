'use strict';

// Coordinates follow the artwork from its top left, in physical cabinet inches.
function labelAt(panel, x, y, width) {
  const regions = window.cabinetLabelMaps?.[width]?.[panel] || [];
  let match = null, smallest = Infinity;
  for (const entry of regions) {
    const [left, top, w, h] = entry.rect;
    if (x >= left && x <= left + w && y >= top && y <= top + h && w * h < smallest) {
      match = entry.id;
      smallest = w * h;
    }
  }
  return match;
}

function projectedLabel(clientX, clientY, bounds, frame, width) {
  if (!bounds.width || !bounds.height) return null;
  const a = frame.yaw * Math.PI / 180, p = frame.pitch * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(p), sp = Math.sin(p);
  const u = ((clientX - bounds.left) / bounds.width - .5) * frame.width;
  const v = (.5 - (clientY - bounds.top) / bounds.height) * frame.height;
  const x = frame.targetX + u * ca - v * sa * sp, y = u * sa + v * ca * sp;
  const z = frame.targetZ + v * cp, dx = sa * cp, dy = -ca * cp;
  const edge = .017;
  const half = width / 2;
  // The back and both sides are planar exterior surfaces of a convex cabinet.
  // Only a surface facing the camera can contain the displayed point.
  if (dy > .0001) {
    const t = (6.007 - y) / dy;
    const px = width * (half - edge - x - t * dx) / (width - 2 * edge);
    const py = 52 * (52 - edge - z - t * sp) / (52 - 2 * edge);
    if (px >= 0 && px <= width && py >= 0 && py <= 52) return labelAt('rear', px, py, width);
  }
  if (Math.abs(dx) > .0001) {
    const right = dx > 0;
    const t = ((right ? 1 : -1) * (half + .007) - x) / dx;
    const px = 12 * (6 - edge + (right ? 1 : -1) * (y + t * dy)) / (12 - 2 * edge);
    const py = 52 * (52 - edge - z - t * sp) / (52 - 2 * edge);
    if (px >= 0 && px <= 12 && py >= 0 && py <= 52) return labelAt(right ? 'right' : 'left', px, py, width);
  }
  return null;
}

function startLabelViewer(onVisibilityChange) {
  const picker = document.querySelector('#label-picker');
  const dialog = document.querySelector('#label-dialog');
  const browse = document.querySelector('#label-browse');
  const stage = document.querySelector('#label-stage'), image = document.querySelector('#label-art');
  const smaller = document.querySelector('#label-smaller'), larger = document.querySelector('#label-larger');
  const fit = document.querySelector('#label-fit'), pdf = document.querySelector('#label-pdf');
  const close = document.querySelector('#label-close'), status = document.querySelector('#label-status');
  const products = new Map();
  const pointers = new Map();
  let selected = '', zoom = 1, panX = 0, panY = 0, focusTarget = null;
  const limit = 16;
  function paint() {
    if (!dialog.open || !image.naturalWidth || !image.naturalHeight) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const base = Math.min((w - 16) / image.naturalWidth, (h - 16) / image.naturalHeight);
    const iw = image.naturalWidth * base * zoom, ih = image.naturalHeight * base * zoom;
    const mx = Math.max(0, (iw - w) / 2), my = Math.max(0, (ih - h) / 2);
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
    Object.assign(image.style, {
      width: iw + 'px', height: ih + 'px', left: ((w - iw) / 2 + panX) + 'px', top: ((h - ih) / 2 + panY) + 'px'
    });
    fit.textContent = Math.round(zoom * 100) + '%';
    fit.setAttribute('aria-label', 'Fit label to screen. Current zoom ' + fit.textContent);
    smaller.disabled = zoom <= 1;
    larger.disabled = zoom >= limit;
    stage.classList.toggle('can-pan', zoom > 1);
  }
  function adjust(factor, point, from = point) {
    const next = Math.max(1, Math.min(limit, zoom * factor));
    const r = stage.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const scale = next / zoom;
    panX = point.x - cx - (from.x - cx - panX) * scale;
    panY = point.y - cy - (from.y - cy - panY) * scale;
    zoom = next;
    paint();
  }
  function center() {
    const r = stage.getBoundingClientRect();
    return {x: r.left + r.width / 2, y: r.top + r.height / 2};
  }
  function reset() { zoom = 1; panX = 0; panY = 0; paint(); }
  smaller.onclick = () => adjust(1 / 1.5, center());
  larger.onclick = () => adjust(1.5, center());
  fit.onclick = reset;
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1);
    adjust(Math.exp(-Math.max(-240, Math.min(240, delta)) * .003), {x: e.clientX, y: e.clientY});
  }, {passive: false});
  stage.onpointerdown = e => {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  };
  function gesture() {
    const [a, b] = pointers.values();
    return b ? {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, gap: Math.hypot(a.x - b.x, a.y - b.y)} : a;
  }
  stage.onpointermove = e => {
    if (!pointers.has(e.pointerId)) return;
    const before = gesture();
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const after = gesture();
    adjust(before.gap && after.gap ? after.gap / before.gap : 1, after, before);
  };
  stage.onpointerup = stage.onpointercancel = stage.onlostpointercapture = e => pointers.delete(e.pointerId);
  stage.ondblclick = e => {
    if (zoom > 1) reset();
    else adjust(2, {x: e.clientX, y: e.clientY});
  };
  dialog.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.tagName === 'SELECT') return;
    if (e.key === '+' || e.key === '=') adjust(1.5, center());
    else if (e.key === '-') adjust(1 / 1.5, center());
    else if (e.key === '0') reset();
    else if (e.target === stage && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      panX += (Number(e.key === 'ArrowLeft') - Number(e.key === 'ArrowRight')) * 48;
      panY += (Number(e.key === 'ArrowUp') - Number(e.key === 'ArrowDown')) * 48;
      paint();
    } else return;
    e.preventDefault();
  });
  new ResizeObserver(paint).observe(stage);
  image.onload = () => { status.textContent = ''; image.hidden = false; paint(); };
  image.onerror = () => { image.hidden = true; status.textContent = 'The label preview could not load. You can open its PDF below.'; };
  function show(id) {
    const item = products.get(id);
    if (!item) return;
    if (!dialog.open) {
      focusTarget = document.activeElement;
      dialog.showModal();
      onVisibilityChange(true);
    }
    if (selected === id) return;
    selected = id;
    browse.value = id;
    document.querySelector('#label-brand').textContent = item.brand;
    document.querySelector('#label-heading').textContent = item.name;
    image.alt = item.brand + ' ' + item.name + ' front label';
    const file = './labels/' + encodeURIComponent(id);
    pdf.href = file + '.pdf';
    pdf.download = item.brand + ' - ' + item.name + '.pdf';
    status.textContent = 'Loading label…';
    image.hidden = true;
    image.src = file + '.svg';
    reset();
  }
  function hide() {
    if (!dialog.open) return;
    dialog.close();
    selected = '';
    pointers.clear();
    onVisibilityChange(false);
    if (focusTarget?.isConnected) focusTarget.focus({preventScroll:true});
    focusTarget = null;
  }
  function open(id) {
    if (!products.has(id)) return false;
    const url = new URL(location.href);
    const method = dialog.open ? 'replaceState' : 'pushState';
    const state = dialog.open ? history.state : {...history.state, cabinetLabelEntry: true};
    url.searchParams.set('label', id);
    history[method](state, '', url);
    show(id);
    return true;
  }
  function dismiss() {
    if (history.state?.cabinetLabelEntry) history.back();
    else {
      const url = new URL(location.href);
      url.searchParams.delete('label');
      history.replaceState(history.state, '', url);
      hide();
    }
  }
  function fromLocation() {
    const id = new URL(location.href).searchParams.get('label');
    if (products.has(id)) show(id); else hide();
  }
  close.onclick = dismiss;
  dialog.addEventListener('cancel', e => { e.preventDefault(); dismiss(); });
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dismiss();
  });
  picker.onchange = () => { open(picker.value); picker.value = ''; };
  browse.onchange = () => open(browse.value);
  window.addEventListener('popstate', fromLocation);
  function install(items) {
    const groups = new Map();
    for (const item of items) {
      products.set(item.id, item);
      if (!groups.has(item.brand)) {
        const group = document.createElement('optgroup');
        group.label = item.brand;
        groups.set(item.brand, group);
      }
      groups.get(item.brand).append(new Option(item.name, item.id));
    }
    for (const group of groups.values()) { browse.append(group.cloneNode(true)); picker.append(group); }
    picker.disabled = false;
    fromLocation();
  }
  fetch('./labels/catalog.json').then(r => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }).then(install).catch(error => {
    picker.options[0].text = 'Labels unavailable';
    console.error('Product label catalog could not load', error);
  });
  return {open, has: id => products.has(id), isOpen: () => dialog.open};
}
