// The 50 bot levels. Stockfish does the thinking; this file decides how hard it thinks and which of its
// candidate moves a level actually plays. Nothing here uses Math.random or the clock, so the same
// (game id, ply, level, engine output) always gives the same move on the phone, in the browser and on the server.
const LEVELS = 50;
const TIERS = [
  { name: 'Beginner', from: 1, to: 10, icon: '🐣' }, { name: 'Casual', from: 11, to: 20, icon: '🙂' }, { name: 'Club', from: 21, to: 30, icon: '♟️' },
  { name: 'Advanced', from: 31, to: 40, icon: '🎯' }, { name: 'Master', from: 41, to: 50, icon: '👑' }];
const tierOf = l => TIERS.find(t => l <= t.to) || TIERS[TIERS.length - 1];

// nodes : Stockfish node budget per move (its "thinking time", machine-independent)
// mpv   : how many candidate moves Stockfish reports
// temp  : how freely the level strays from the best candidate, in centipawns
// rp    : chance of playing a random legal move instead
const LV = [null];
for (let L = 1; L <= LEVELS; L++) {
  const t = (L - 1) / (LEVELS - 1);
  LV.push({
    nodes: Math.round(30 * Math.pow(1.21, L - 1)),
    mpv: L <= 10 ? 6 : L <= 20 ? 5 : L <= 30 ? 4 : L <= 40 ? 3 : L <= 47 ? 2 : 1,
    temp: Math.round(250 * Math.pow(1 - t, 1.5)),
    rp: Math.max(0, +(0.6 * (1 - (L - 1) / 11)).toFixed(3)),
  });
}

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const botSeed = (gameId, ply) => hashStr(gameId + ':' + ply);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// lines: Stockfish candidates [{ mv, cp }] best first; legal: sorted legal UCI moves.
function pick(level, seed, legal, lines) {
  if (!legal.length) return null;
  const p = LV[level], r = rng(seed);
  if (r() < p.rp) return legal[Math.floor(r() * legal.length)];
  const ok = lines.filter(x => legal.includes(x.mv));
  if (!ok.length) return legal[0];
  if (ok.length === 1 || p.temp <= 0) return ok[0].mv;
  const best = ok[0].cp, w = ok.map(x => Math.exp(-(best - x.cp) / p.temp));
  let x = r() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ok.length; i++) { x -= w[i]; if (x <= 0) return ok[i].mv; }
  return ok[0].mv;
}

// The bot takes a draw once the game is 20+ plies old and it is not better. botCp is Stockfish's score for the bot.
const DRAW_NODES = 20000;
const acceptsDraw = (botCp, level, plies) => plies >= 20 && botCp <= 25 - level;

// Bot ratings shown to players and used for Elo against bots.
const botRating = l => 400 + l * 50;

module.exports = { LEVELS, TIERS, tierOf, LV, hashStr, botSeed, rng, pick, DRAW_NODES, acceptsDraw, botRating };
