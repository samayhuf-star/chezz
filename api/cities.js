const L = require('./_lib.js');
// City vs City: every city's season total (bot points plus live-game points earned this calendar month).
let cache = { t: 0, k: '', rows: [] };
module.exports = L.handler('GET', async (req, res) => {
  const q = req.query || {}, k = L.seasonKey();
  if (Date.now() - cache.t > 20000 || cache.k !== k) {
    const all = await L.store.listJSON('players/', 5000), by = new Map();
    for (const d of all) {
      if (!d || !d.name || !d.city || !d.country) continue;
      const key = [d.country, d.state, d.city].map(L.norm).join('|');
      let c = by.get(key);
      if (!c) by.set(key, c = { key, city: d.city, state: d.state || '', country: d.country, pts: 0, players: 0, active: 0 });
      const p = L.seasonPts(d); c.players++; c.pts += p; if (p > 0) c.active++;
    }
    const rows = [...by.values()].sort((a, b) => b.pts - a.pts || b.active - a.active || a.city.localeCompare(b.city));
    rows.forEach((r, i) => { r.rank = i + 1; });
    cache = { t: Date.now(), k, rows };
  }
  const now = new Date(), ends = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const mineKey = q.city && q.country ? [q.country, q.state, q.city].map(L.norm).join('|') : '';
  const mine = mineKey ? cache.rows.find(r => r.key === mineKey) || null : null;
  let you = 0;
  if (q.id) { const d = await L.loadPlayer(q.id); if (d) you = L.seasonPts(d); }
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
  res.status(200).json({ season: k, ends, daysLeft: Math.max(1, Math.ceil((ends - Date.now()) / 86400000)), total: cache.rows.length, mine, you, rows: cache.rows.slice(0, 50) });
});
