const L = require('./_lib.js');
const crypto = require('crypto');
// Issues a signed ranked-game ticket. Moves are played in the browser; the server re-checks everything on /api/claim.
module.exports = L.handler('POST', async (req, res, b) => {
  const doc = await L.loadPlayer(b.id);
  if (!L.authOK(doc, b.secret)) return res.status(403).json({ error: 'Not signed in' });
  const level = b.level | 0, human = b.human === -1 ? -1 : 1;
  if (level < 1 || level > L.E.LEVELS) return res.status(400).json({ error: 'Bad level' });
  const recent = (doc.claimed || []).filter(c => Date.now() - c.ts < 3600 * 1000).length;
  if (recent >= 40) return res.status(429).json({ error: 'Too many ranked games this hour. Take a break!' });
  const st = { g: crypto.randomBytes(8).toString('hex'), l: level, h: human, ts: Date.now(), tc: [420, 0] } // one fixed time control: 7 minutes each, no increment;
  res.status(200).json({ token: L.sign(st), g: st.g });
});
