const L = require('./_lib.js');
const crypto = require('crypto');
module.exports = L.handler('POST', async (req, res, b) => {
  let doc, secret;
  if (!b.id) {
    secret = crypto.randomBytes(16).toString('hex');
    doc = { id: crypto.randomBytes(8).toString('hex'), secretHash: L.sha(secret), name: '', city: '', state: '', country: '',
      points: 0, w: 0, l: 0, d: 0, best: 0, games: 0, beaten: [], claimed: [], created: Date.now() };
  } else {
    doc = await L.loadPlayer(b.id);
    if (!L.authOK(doc, b.secret)) return res.status(403).json({ error: 'Not signed in' });
  }
  if (b.name !== undefined) {
    const name = L.clean(b.name, 24), city = L.clean(b.city, 40), state = L.clean(b.state, 40), country = L.clean(b.country, 40);
    if (!name) return res.status(400).json({ error: 'Please enter a display name' });
    if (L.badText(name + ' ' + city + ' ' + state + ' ' + country)) return res.status(400).json({ error: 'Links are not allowed in names or places' });
    Object.assign(doc, { name, city, state, country });
  } else if (!doc.name) return res.status(400).json({ error: 'Please enter a display name' });
  doc.updated = Date.now();
  await L.savePlayer(doc);
  res.status(200).json({ id: doc.id, secret, doc: L.myDoc(doc) });
});
