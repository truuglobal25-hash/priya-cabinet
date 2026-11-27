'use strict';
globalThis.CabinetPrint = (() => {
  const digest = async data => {
    const bytes = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,'0')).join('');
  };
  const validSha = id => /^[a-f0-9]{64}$/.test(id);
  async function manifest(base, id) {
    if (!validSha(id)) throw Error('Unknown print edition.');
    const response=await fetch(new URL('editions/'+id+'/manifest.json',base),{cache:'no-cache'});
    if (!response.ok) throw Error('The print edition could not be opened.');
    const data=await response.json();
    if (data.sha256!==id || !Number.isSafeInteger(data.bytes) || !Array.isArray(data.parts) || !data.parts.length ||
        data.parts.some(p=>!validSha(p.sha256)||!Number.isSafeInteger(p.bytes)||p.bytes<1||p.bytes>16*1024*1024) ||
        data.parts.reduce((n,p)=>n+p.bytes,0)!==data.bytes) throw Error('The print manifest is incomplete.');
    if (data.archiveCommit) {
      if (!/^[0-9a-f]{40}$/.test(data.archiveCommit)) throw Error('Unknown print archive.');
      for (const part of data.parts) part.archiveCommit=data.archiveCommit;
    }
    return data;
  }
  async function read(base,part) {
    const storage = part.archiveCommit
      ? new URL('https://raw.githubusercontent.com/truuglobal25-hash/priya-cabinet/' + part.archiveCommit + '/print/')
      : base;
    const url = new URL('parts/' + part.sha256 + '.bin', storage);
    const retries = [0, 400, 1200, 3000];
    let lastError;
    for (const delay of retries) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const response = await fetch(url, {cache: delay ? 'reload' : 'default'});
        if (!response.ok) throw Error('A print segment could not be downloaded.');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== part.bytes || await digest(bytes) !== part.sha256) {
          throw Error('A downloaded print segment failed verification. Please try again.');
        }
        return bytes;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }
  function range(value, total) {
    const m=/^bytes=(\d*)-(\d*)$/i.exec(value||'');
    if (!m || (!m[1]&&!m[2])) return null;
    const first=m[1]?Number(m[1]):Math.max(0,total-Number(m[2]));
    const last=m[1]&&m[2]?Math.min(Number(m[2]),total-1):total-1;
    return Number.isSafeInteger(first)&&Number.isSafeInteger(last)&&first>=0&&first<=last&&first<total ? {first,last}:null;
  }
  return {digest,validSha,manifest,read,range};
})();
