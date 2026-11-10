// Storage layer: Vercel Blob in production, in-memory map when STORE=mem (tests).
const mem = new Map();
const isMem = () => process.env.STORE === 'mem';

async function getJSON(path) {
  if (isMem()) { const v = mem.get(path); return v ? JSON.parse(v) : null; }
  const { head } = require('@vercel/blob');
  try {
    const h = await head(path);
    const r = await fetch(h.url + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    if (e && (e.name === 'BlobNotFoundError' || /not.?found/i.test(String(e.message || '')))) return null;
    throw e;
  }
}
async function putJSON(path, obj) {
  const body = JSON.stringify(obj);
  if (isMem()) { mem.set(path, body); return; }
  const { put } = require('@vercel/blob');
  await put(path, body, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}
async function listJSON(prefix, cap) {
  cap = cap || 5000;
  if (isMem()) { const out = []; for (const [k, v] of mem) if (k.startsWith(prefix)) out.push(JSON.parse(v)); return out; }
  const { list } = require('@vercel/blob');
  let cursor, urls = [];
  do {
    const r = await list({ prefix, limit: 1000, cursor });
    urls.push(...r.blobs.map(b => b.url));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor && urls.length < cap);
  urls = urls.slice(0, cap);
  const out = [];
  for (let i = 0; i < urls.length; i += 50) {
    const batch = await Promise.all(urls.slice(i, i + 50).map(u =>
      fetch(u + '?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)));
    batch.forEach(x => { if (x) out.push(x); });
  }
  return out;
}
module.exports = { getJSON, putJSON, listJSON };
