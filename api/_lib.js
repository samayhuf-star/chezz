const crypto = require('crypto');
const E = require('../public/engine.js');
const store = require('./_store.js');

const SECRET = () => process.env.CHESS_SECRET || '';
const TOKEN_TTL = 24 * 3600 * 1000;
const VERIFY_NODE_BUDGET = 450000; // max total search nodes spent re-checking bot moves per claim

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
  points: d.points | 0, w: d.w | 0, l: d.l | 0, d: d.d | 0, best: d.best | 0, games: d.games | 0, beaten: d.beaten || [] });

/* Re-check a finished game. Returns {ok, error, result:'w'|'l'|'d', reason, plies}. */
function verifyGame(st, c) {
  const moves = c.moves;
  if (!Array.isArray(moves) || moves.length < 1 || moves.length > 600) return { error: 'Bad move list' };
  const rep = E.replay(moves);
  if (!rep) return { error: 'Illegal move in game' };
  const { G, keys } = rep;
  const human = st.h; // 1 = white
  // game must have started with the right side: bot opens when human is black (checked by replay order)
  const rule = E.outcome(G, keys);
  let result, reason;
  const sideRes = r => r === 'd' ? 'd' : ((r === 'w') === (human === 1) ? 'w' : 'l');
  if (rule) { result = sideRes(rule.r); reason = rule.why; }
  else if (c.end === 'resign') {
    if (G.t !== human && moves.length % 2 === (human === 1 ? 0 : 1)) { /* resigned on bot's turn is odd but allowed */ }
    result = 'l'; reason = 'Resigned';
  } else if (c.end === 'timeout') { result = 'l'; reason = 'Lost on time'; }
  else if (c.end === 'draw') {
    // bot must really have accepted: recompute its decision at the offer position
    const at = c.drawAt | 0;
    if (at !== moves.length || G.t !== human) return { error: 'Draw not valid' };
    if (!E.botAcceptsDraw(G, st.l, moves.length)) return { error: 'Draw not accepted by bot' };
    result = 'd'; reason = 'Draw agreed';
  } else return { error: 'Game not finished' };

  // who moved each ply: human moves on plies with parity matching colour
  const humanPly = i => (i % 2 === 0) === (human === 1);
  // re-derive a sample of bot moves with the same deterministic engine
  const botPlies = []; for (let i = 0; i < moves.length; i++) if (!humanPly(i)) botPlies.push(i);
  if (st.h === -1 && moves.length && humanPly(0)) return { error: 'Wrong side to move' };
  const nodesPer = E.LV[st.l].nodes;
  let n = Math.max(1, Math.min(botPlies.length, Math.floor(VERIFY_NODE_BUDGET / nodesPer)));
  if (st.l <= 3) n = Math.min(botPlies.length, 12);
  // random sample (server-side randomness so a cheater cannot predict which plies are checked); always include the first bot move
  const chosen = new Set(botPlies.slice(0, 1));
  const pool = botPlies.slice(1);
  while (chosen.size < n && pool.length) { const k = crypto.randomInt(pool.length); chosen.add(pool.splice(k, 1)[0]); }
  for (const ply of chosen) {
    const g2 = E.replay(moves.slice(0, ply)).G;
    const want = E.think(g2, st.l, E.botSeed(st.g, ply));
    if (want !== moves[ply]) return { error: 'Bot move mismatch' };
  }
  const humanMoves = moves.length - botPlies.length;
  return { ok: true, result, reason, plies: moves.length, humanMoves };
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
const myDoc = d => Object.assign(publicDoc(d), { guest: !d.email, email: d.email || '', stats: statsOf(d) });
module.exports = { authOK, hashPw, emailKey, blankStats, statsOf, myDoc, E, store, sign, verify, sha, clean, badText, norm, validId, loadPlayer, savePlayer, publicDoc, verifyGame, handler };
