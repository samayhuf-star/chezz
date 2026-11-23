const L = require('./_lib.js');
// Records a finished game after re-playing it on the server.
module.exports = L.handler('POST', async (req, res, b) => {
  const doc = await L.loadPlayer(b.id);
  if (!L.authOK(doc, b.secret)) return res.status(403).json({ error: 'Not signed in' });
  const st = L.verify(b.token);
  if (!st) return res.status(400).json({ error: 'Game ticket expired or invalid' });
  doc.claimed = doc.claimed || [];
  if (doc.claimed.some(c => c.g === st.g)) return res.status(409).json({ error: 'Already recorded', doc: L.myDoc(doc) });
  const v = await L.verifyGame(st, b);
  if (!v.ok) return res.status(400).json({ error: v.error });
  // plausibility: a human cannot play this many moves this fast
  const elapsed = Date.now() - st.ts;
  if (v.result !== 'l' && elapsed < v.humanMoves * (process.env.MIN_MS_PER_MOVE !== undefined ? +process.env.MIN_MS_PER_MOVE : 600)) return res.status(400).json({ error: 'Game was too fast to be valid' });
  const long = v.plies >= 4;
  const pts = long ? (v.result === 'w' ? st.l * 10 : v.result === 'd' ? st.l * 4 : 0) : 0;
  doc.points = (doc.points | 0) + pts; if (pts) L.addSeason(doc, pts); doc.games = (doc.games | 0) + 1;
  // Elo-style rating against the bot's rating (level 1 = 450 ... level 50 = 2900). Only games of 4+ plies count.
  let dr = 0;
  if (long) {
    const R = (doc.rating | 0) || 800, botR = L.E.botRating(st.l), exp = 1 / (1 + Math.pow(10, (botR - R) / 400));
    const sc = v.result === 'w' ? 1 : v.result === 'd' ? 0.5 : 0, K = (doc.games | 0) <= 30 ? 40 : 24;
    doc.rating = Math.max(100, Math.round(R + K * (sc - exp))); dr = doc.rating - R;
  }
  if (v.result === 'w') {
    doc.w = (doc.w | 0) + 1; doc.beaten = doc.beaten || [];
    if (long && !doc.beaten.includes(st.l)) doc.beaten.push(st.l);
    if (long && st.l > (doc.best | 0)) doc.best = st.l;
  } else if (v.result === 'l') doc.l = (doc.l | 0) + 1; else doc.d = (doc.d | 0) + 1;
  const S = L.statsOf(doc), mine = st.h === 1 ? S.white : S.black, k = v.result;
  mine[k]++; S.lv[st.l] = S.lv[st.l] || { w: 0, l: 0, d: 0 }; S.lv[st.l][k]++;
  S.streak = k === 'w' ? (S.streak > 0 ? S.streak + 1 : 1) : k === 'l' ? (S.streak < 0 ? S.streak - 1 : -1) : 0;
  S.bestStreak = Math.max(S.bestStreak | 0, S.streak);
  S.plies += v.plies; S.secs += Math.min(7200, Math.round(elapsed / 1000));
  if (b.end === 'timeout') S.timeouts++; if (b.end === 'resign') S.resigns++;
  S.recent = [{ l: st.l, r: k, why: v.reason, c: st.h === 1 ? 'w' : 'b', p: v.plies, pts, dr, ts: Date.now() }].concat(S.recent).slice(0, 20);
  doc.stats = S;
  doc.claimed.push({ g: st.g, ts: Date.now() });
  doc.claimed = doc.claimed.filter(c => Date.now() - c.ts < 3 * 24 * 3600 * 1000).slice(-200);
  doc.updated = Date.now();
  await L.savePlayer(doc);
  res.status(200).json({ awarded: pts, ratingChange: dr, result: v.result, reason: v.reason, doc: L.myDoc(doc) });
});
