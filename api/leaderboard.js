const L = require('./_lib.js');
let cache = { t: 0, rows: [] };
module.exports = L.handler('GET', async (req, res) => {
  const q = req.query || {};
  if (Date.now() - cache.t > 20000) {
    const all = await L.store.listJSON('players/', 5000);
    cache = { t: Date.now(), rows: all.filter(d => d && d.name).map(L.publicDoc) };
  }
  const scope = ['city', 'state', 'country', 'world'].includes(q.scope) ? q.scope : 'world';
  const city = L.norm(q.city), state = L.norm(q.state), country = L.norm(q.country);
  let rows = cache.rows.filter(r => {
    if (scope === 'world') return true;
    if (L.norm(r.country) !== country || !country) return false;
    if (scope === 'country') return true;
    if (L.norm(r.state) !== state) return false;
    if (scope === 'state') return true;
    return L.norm(r.city) === city;
  });
  rows.sort((a, b) => b.points - a.points || b.w - a.w || a.name.localeCompare(b.name));
  const idx = q.id ? rows.findIndex(r => r.id === q.id) : -1;
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
  res.status(200).json({ total: rows.length, rank: idx >= 0 ? idx + 1 : null, rows: rows.slice(0, 50) });
});
