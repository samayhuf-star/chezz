const L = require('./_lib.js');
// A player reports another player's name or place. Reports are stored for review; nothing is shown to other players.
module.exports = L.handler('POST', async (req, res, b) => {
  if (!L.validId(b.target)) return res.status(400).json({ error: 'Unknown player' });
  const by = L.validId(b.id) ? b.id : 'anon', ts = Date.now();
  await L.store.putJSON('reports/' + ts + '-' + b.target + '.json', { ts, by, target: b.target, name: L.clean(b.name, 40), place: L.clean(b.place, 120) });
  res.status(200).json({ ok: true });
});
