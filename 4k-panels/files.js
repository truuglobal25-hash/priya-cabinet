'use strict';
// The print PDFs reuse the exact compressed artwork streams in the public master.
// Each output segment identifies a contiguous interval within one verified source.
globalThis.CabinetFiles = (() => {
  const hex = /^[a-f0-9]{64}$/;
  const cache = new Map();
  const pending = new Map();
  let cacheBytes = 0;
  let manifestPromise;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2,'0')).join('');

  async function edition(base, width, type) {
    if (!['18','24','36'].includes(width) || !['zip','pdf'].includes(type)) throw Error('Unknown cabinet download.');
    if (!manifestPromise) {
      manifestPromise = fetch(new URL('print-files/recipes/manifest.json?edition=019b8074f3', base), {cache:'no-cache'}).then(response => {
        if (!response.ok) throw Error('The cabinet download list is unavailable.');
        return response.json();
      }).catch(error => {manifestPromise = null; throw error;});
    }
    const manifest = await manifestPromise;
    const file = manifest.editions[width][type];
    const suffix = type === 'pdf' ? 'Print.pdf' : '4K-and-Print.zip';
    const filename = 'Yusuf-Green-Cabinet-' + width + 'in-' + suffix;
    if (file.filename !== filename || !hex.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !Array.isArray(file.segments)) throw Error('The cabinet file metadata is incomplete.');
    let total = 0;
    for (const [id, offset, length] of file.segments) {
      const source = manifest.sources[id];
      if (!source || !hex.test(source.sha256) || !Number.isSafeInteger(source.bytes) || source.bytes < 1 || source.bytes > 16*1024*1024 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(length) || length <= 0 || offset + length > source.bytes) throw Error('The cabinet file recipe is incomplete.');
      total += length;
    }
    if (total !== file.bytes) throw Error('The cabinet file length is incorrect.');
    return {file, sources:manifest.sources};
  }

  async function fetchSource(base, source) {
    let failure;
    for (const delay of [0, 350, 1200, 2800]) {
      if (delay) await sleep(delay);
      try {
        const response = await fetch(new URL(source.url, base), {cache:delay ? 'reload' : 'default'});
        if (!response.ok) throw Error('A cabinet file segment could not be downloaded.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length !== source.bytes || await digest(bytes) !== source.sha256) throw Error('A cabinet file segment failed verification.');
        return bytes;
      } catch (error) { failure = error; }
    }
    throw failure;
  }

  function remember(id,bytes) {
    while (cacheBytes+bytes.length>48*1024*1024 && cache.size) {
      const first=cache.keys().next().value;
      cacheBytes-=cache.get(first).length;cache.delete(first);
    }
    if (!cache.has(id)) cacheBytes+=bytes.length;
    cache.set(id,bytes);
    return bytes;
  }

  async function sourceBytes(base, source) {
    const id = source.sha256;
    if (cache.has(id)) {
      const hit = cache.get(id);
      cache.delete(id); cache.set(id, hit);
      return hit;
    }
    if (!pending.has(id)) {
      pending.set(id, fetchSource(base, source).then(bytes=>remember(id,bytes)).finally(()=>pending.delete(id)));
    }
    return pending.get(id);
  }

  function range(header, size) {
    if (!header) return [0, size];
    const match = /^bytes=(\d*)-(\d*)$/i.exec(header);
    if (!match || (!match[1] && !match[2])) return null;
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(size, Number(match[2])+1) : size;
    return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start < end && start < size ? [start,end] : null;
  }

  async function* chunks(base, {file, sources}, start, end) {
    let cursor=0;
    const needed=[], remaining=new Map();
    for (const [id, offset, length] of file.segments) {
      if (cursor>=end) break;
      const next=cursor+length;
      if (next>start) {
        needed.push([id,offset+Math.max(0,start-cursor),offset+Math.min(length,end-cursor)]);
        remaining.set(id,(remaining.get(id)||0)+1);
      }
      cursor=next;
    }
    // Keep repeatedly used source blocks on disk during a long transfer. This
    // avoids refetching shared PDF objects while capping the in-memory cache.
    const prefix='yusuf-print-spool-', now=Date.now();
    const key=prefix+now+'-'+Math.random().toString(36).slice(2);
    let spool;
    const stored=new Set();
    try {
      if (needed.length>3 && globalThis.caches) {
        try {
          for (const previous of await caches.keys()) if (previous.startsWith(prefix) && Number(previous.slice(prefix.length).split('-')[0])<now-86400000) await caches.delete(previous);
          spool=await caches.open(key);
        } catch { /* Private browsing can disable disk spooling. */ }
      }
      for (const [id,from,to] of needed) {
        const source=sources[id];
        const count=remaining.get(id)-1;
        remaining.set(id,count);
        const local=new URL('print-files/cache/'+source.sha256,base).href;
        let buffer;
        if (!cache.has(source.sha256) && stored.has(id)) {
          try {
            const saved=await spool.match(local);
            if (saved) buffer=new Uint8Array(await saved.arrayBuffer());
            if (!buffer || buffer.length!==source.bytes) {buffer=null;stored.delete(id);}
            else remember(source.sha256,buffer);
          } catch {stored.delete(id);}
        }
        if (!buffer) buffer=await sourceBytes(base,source);
        if (spool && count && !stored.has(id)) {
          try {await spool.put(local,new Response(buffer));stored.add(id);} catch { /* HTTP caching is still available. */ }
        } else if (spool && count===0 && stored.delete(id)) {
          try {await spool.delete(local);} catch { /* The entire transfer cache is removed below. */ }
        }
        yield buffer.subarray(from,to);
      }
    } finally {
      if (spool) try {await caches.delete(key);} catch { /* Removed on a subsequent transfer. */ }
    }
  }
  return {edition, range, chunks};
})();
