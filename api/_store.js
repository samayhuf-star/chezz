// Storage layer: Vercel Blob in production, in-memory map when STORE=mem (tests).
const mem = new Map();
const isMem = () => process.env.STORE === 'mem';
// Cloudflare D1 (set per request by src/worker.mjs): a single table kv(k TEXT PRIMARY KEY, v TEXT)
const D1 = () => globalThis.__DB || null;

async function getJSON(path) {
  if (D1()) { const r = await D1().prepare('SELECT v FROM kv WHERE k = ?').bind(path).first(); return r ? JSON.parse(r.v) : null; }
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
  if (D1()) { await D1().prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(path, body).run(); return; }
  if (isMem()) { mem.set(path, body); return; }
  const { put } = require('@vercel/blob');
  await put(path, body, { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}
async function listJSON(prefix, cap) {
  cap = cap || 5000;
  if (D1()) { const r = await D1().prepare('SELECT v FROM kv WHERE k LIKE ? LIMIT ?').bind(prefix + '%', cap).all(); return r.results.map(x => JSON.parse(x.v)); }
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
async function delJSON(path) {
  if (D1()) { await D1().prepare('DELETE FROM kv WHERE k = ?').bind(path).run(); return; }
  if (isMem()) { mem.delete(path); return; }
  const { del } = require('@vercel/blob');
  try { await del(path); } catch (e) {}
}
module.exports = { getJSON, putJSON, listJSON, delJSON };
