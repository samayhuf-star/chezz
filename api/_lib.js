const crypto = require('crypto');
const E = require('../core');
const engine = require('./_engine.js');
const store = require('./_store.js');

const SECRET = () => process.env.CHESS_SECRET || '';
const TOKEN_TTL = 24 * 3600 * 1000;
const VERIFY_NODE_BUDGET = 1200000; // max total Stockfish nodes spent re-checking bot moves per claim

function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const s = crypto.createHmac('sha256', SECRET()).update(p).digest('base64url');
  return p + '.' + s;
}
function verify(tok) {
  if (typeof tok !== 'string' || !SECRET()) return null;
  const i = tok.lastIndexOf('.'); if (i < 0) return null;
  const p = tok.slice(0, i), s = tok.slice(i + 1);
  const exp = crypto.createHmac('sha256', SECRET()).update(p).digest('base64url');
  const a = Buffer.from(s), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const st = JSON.parse(Buffer.from(p, 'base64url').toString());
    if (!st || Date.now() - st.ts > TOKEN_TTL) return null;
    return st;
  } catch (e) { return null; }
}
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const badText = s => /https?:|www\.|\.(com|net|org|in|io|co)\b/i.test(s);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const validId = id => typeof id === 'string' && /^[a-f0-9]{16}$/.test(id);

async function loadPlayer(id) { return validId(id) ? store.getJSON('players/' + id + '.json') : null; }
async function savePlayer(doc) { return store.putJSON('players/' + doc.id + '.json', doc); }
const authOK = (d, secret) => !!d && !!secret && (d.secretHash === sha(secret) || (d.sessions || []).includes(sha(secret)));
const PBKDF2_ITER = 100000;
async function hashPw(pw, saltHex) {
  const subtle = crypto.webcrypto.subtle, salt = Buffer.from(saltHex, 'hex');
  const key = await subtle.importKey('raw', Buffer.from(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITER }, key, 256);
  return Buffer.from(bits).toString('hex');
}
const emailKey = e => 'emails/' + sha(String(e).trim().toLowerCase()) + '.json';
const blankStats = () => ({ lv: {}, white: { w: 0, l: 0, d: 0 }, black: { w: 0, l: 0, d: 0 }, streak: 0, bestStreak: 0, plies: 0, secs: 0, timeouts: 0, resigns: 0, recent: [] });
const statsOf = d => Object.assign(blankStats(), d.stats || {});
const publicDoc = d => ({ id: d.id, name: d.name, city: d.city, state: d.state, country: d.country,
  points: d.points | 0, w: d.w | 0, l: d.l | 0, d: d.d | 0, best: d.best | 0, games: d.games | 0, beaten: d.beaten || [], rating: (d.rating | 0) || 800,
  // live player-vs-player record
  orating: (d.orating | 0) || E.live.START_RATING, ogames: d.ogames | 0, ow: d.ow | 0, ol: d.ol | 0, od: d.od | 0, opeak: (d.opeak | 0) || (d.orating | 0) || E.live.START_RATING });

/* Re-check a finished game. Returns {ok, error, result:'w'|'l'|'d', reason, plies}. Moves are UCI strings. */
async function verifyGame(st, c) {
  const moves = c.moves;
  if (!Array.isArray(moves) || moves.length < 1 || moves.length > 600 || !moves.every(E.validUci)) return { error: 'Bad move list' };
  const rep = E.replay(moves);
  if (!rep) return { error: 'Illegal move in game' };
  const human = st.h, humanSide = human === 1 ? 'w' : 'b'; // st.h: 1 = human plays white
  const rule = E.outcome(rep.chess);
  let result, reason, eng = null;
  const sf = () => eng || (eng = engine()); // one engine per claim
  if (rule) { result = rule.r === 'd' ? 'd' : rule.r === humanSide ? 'w' : 'l'; reason = rule.why; }
  else if (c.end === 'resign') { result = 'l'; reason = 'Resigned'; }
  else if (c.end === 'timeout') { result = 'l'; reason = 'Lost on time'; }
  else if (c.end === 'draw') {
    // the bot must really have accepted: ask Stockfish again at the offer position
    if ((c.drawAt | 0) !== moves.length || rep.chess.turn() !== humanSide) return { error: 'Draw not valid' };
    if (!(await E.botAcceptsDraw(sf(), moves, st.l))) return { error: 'Draw not accepted by bot' };
    result = 'd'; reason = 'Draw agreed';
  } else return { error: 'Game not finished' };

  // the human moves on plies whose parity matches their colour; everything else must be the bot's own move
  const humanPly = i => (i % 2 === 0) === (human === 1);
  const botPlies = []; for (let i = 0; i < moves.length; i++) if (!humanPly(i)) botPlies.push(i);
  const n = Math.max(1, Math.min(botPlies.length, Math.floor(VERIFY_NODE_BUDGET / E.LV[st.l].nodes)));
  // random sample (server-side randomness so a cheater cannot predict which plies are checked); always include the first bot move
  const chosen = new Set(botPlies.slice(0, 1)), pool = botPlies.slice(1);
  while (chosen.size < n && pool.length) { const k = crypto.randomInt(pool.length); chosen.add(pool.splice(k, 1)[0]); }
  for (const ply of chosen) {
    const want = await E.botMove(sf(), moves.slice(0, ply), st.l, st.g);
    if (want !== moves[ply]) return { error: 'Bot move mismatch' };
  }
  return { ok: true, result, reason, plies: moves.length, humanMoves: moves.length - botPlies.length };
}

function handler(method, fn) {
  return async (req, res) => {
    try {
      if (req.method !== method) return res.status(405).json({ error: 'Method not allowed' });
      if (!SECRET()) return res.status(500).json({ error: 'Server not configured' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      await fn(req, res, body || {});
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  };
}
// full document for the signed-in owner (adds guest flag, email and the performance stats)
const myDoc = d => Object.assign(publicDoc(d), { guest: !d.email && !d.apple, apple: !!d.apple, email: d.email || '', stats: statsOf(d), orecent: d.orecent || [] });
module.exports = { authOK, hashPw, emailKey, blankStats, statsOf, myDoc, E, store, sign, verify, sha, clean, badText, norm, validId, loadPlayer, savePlayer, publicDoc, verifyGame, handler };
