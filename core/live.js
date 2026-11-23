// Live player-vs-player games: pure game-room logic (no sockets, no storage), so it runs in the Durable Object
// and in plain Node tests. Time is always passed in, never read from the clock here.
const rules = require('./rules');

const BASE_MS = 7 * 60 * 1000;   // 7 minutes each, no increment
const START_GRACE_MS = 45 * 1000; // both first moves must be played within this, or the game is aborted
const START_RATING = 1000;

// Elo. score: 1 win, 0.5 draw, 0 loss for A. K is higher for a player's first 20 online games.
const kFor = games => (games < 20 ? 32 : 20);
function elo(ra, rb, score, k) { const exp = 1 / (1 + Math.pow(10, (rb - ra) / 400)); return Math.max(100, Math.round(ra + k * (score - exp))); }

// players: { w: { id, name, rating, country }, b: { ... } }
function newRoom(players, now, baseMs) {
  const base = baseMs || BASE_MS;
  return { n: 1, players, moves: [], clk: [base, base], base, last: now, created: now, running: false, over: null, drawOffer: null, rematch: {}, settled: false };
}
const sideOf = (g, id) => (g.players.w.id === id ? 'w' : g.players.b.id === id ? 'b' : null);
const turnOf = g => (g.moves.length % 2 === 0 ? 'w' : 'b'), idx = s => (s === 'w' ? 0 : 1), other = s => (s === 'w' ? 'b' : 'w');
const end = (g, r, why) => { g.over = { r, why }; g.running = false; g.drawOffer = null; };

// Time left for each side right now.
function clocks(g, now) { const c = g.clk.slice(); if (g.running && !g.over) c[idx(turnOf(g))] = Math.max(0, c[idx(turnOf(g))] - (now - g.last)); return c; }

// Ends the game if the side to move has run out of time, or if the game never got going. Returns true if it ended.
function tick(g, now) {
  if (g.over) return false;
  if (!g.running) { if (now - g.created >= START_GRACE_MS) { end(g, 'd', 'Game aborted'); g.aborted = true; return true; } return false; }
  const t = turnOf(g);
  if (clocks(g, now)[idx(t)] <= 0) { g.clk[idx(t)] = 0; end(g, other(t), 'Won on time'); return true; }
  return false;
}
// When the room next needs waking (flag fall or start-grace expiry). null when nothing is pending.
function nextWake(g) { if (g.over) return null; return g.running ? g.last + g.clk[idx(turnOf(g))] : g.created + START_GRACE_MS; }

// Each action returns { error } or {} and mutates g.
function move(g, side, uci, now) {
  if (g.over) return { error: 'Game is over' };
  if (tick(g, now)) return {};
  if (side !== turnOf(g)) return { error: 'Not your turn' };
  const r = rules.replay(g.moves); if (!r || !rules.play(r.chess, uci)) return { error: 'Illegal move' };
  if (g.running) g.clk[idx(side)] -= now - g.last;
  g.moves.push(uci); g.last = now; g.running = g.moves.length >= 2; g.drawOffer = g.drawOffer === side ? side : null;
  const o = rules.outcome(r.chess); if (o) end(g, o.r, o.why);
  return {};
}
function resign(g, side, now) {
  if (g.over) return { error: 'Game is over' };
  if (tick(g, now)) return {};
  if (g.moves.length < 2) { end(g, 'd', 'Game aborted'); g.aborted = true; } else end(g, other(side), 'Resignation');
  return {};
}
// Offers a draw, or accepts one the opponent has offered.
function draw(g, side, now) {
  if (g.over) return { error: 'Game is over' };
  if (tick(g, now)) return {};
  if (g.moves.length < 2) return { error: 'Too early for a draw' };
  if (g.drawOffer === other(side)) end(g, 'd', 'Draw agreed'); else g.drawOffer = side;
  return {};
}
function decline(g, side) { if (g.drawOffer === other(side)) g.drawOffer = null; return {}; }
// Both players asking for a rematch starts a new game in the same room with colours swapped.
function rematch(g, side, now, ratings) {
  if (!g.over) return { error: 'Game is not over' };
  g.rematch[side] = true;
  if (!(g.rematch.w && g.rematch.b)) return {};
  const p = { w: Object.assign({}, g.players.b), b: Object.assign({}, g.players.w) };
  if (ratings) { p.w.rating = ratings[p.w.id] || p.w.rating; p.b.rating = ratings[p.b.id] || p.b.rating; }
  Object.assign(g, newRoom(p, now, g.base), { n: g.n + 1, aborted: false, result: null });
  return { restarted: true };
}
// Rating changes for a finished game. Aborted games change nothing. games: { w, b } = online games played before this one.
function settle(g, games) {
  const rw = g.players.w.rating, rb = g.players.b.rating;
  if (!g.over || g.aborted) return { w: rw, b: rb, dw: 0, db: 0 };
  const sw = g.over.r === 'w' ? 1 : g.over.r === 'd' ? 0.5 : 0;
  const nw = elo(rw, rb, sw, kFor(games.w)), nb = elo(rb, rw, 1 - sw, kFor(games.b));
  return { w: nw, b: nb, dw: nw - rw, db: nb - rb };
}
// What a client is told. `you` is 'w', 'b' or null for nobody in particular.
function view(g, you, now) {
  const pub = p => ({ name: p.name, rating: p.rating, country: p.country || '' });
  return { t: 'state', n: g.n, you, w: pub(g.players.w), b: pub(g.players.b), moves: g.moves, clk: clocks(g, now), turn: turnOf(g), running: g.running, over: g.over, result: g.result || null, drawOffer: g.drawOffer, rematch: g.rematch, base: g.base };
}

// Matchmaking: the allowed rating gap grows the longer the longer-waiting player has waited.
const gapFor = waitedMs => 150 + Math.floor(waitedMs / 5000) * 100;
// queue: [{ id, rating, since }]. Returns the pairs to start, as [a, b] entries, each player at most once.
function pairUp(queue, now) {
  const q = queue.slice().sort((a, b) => a.since - b.since), used = new Set(), pairs = [];
  for (const a of q) {
    if (used.has(a.id)) continue;
    let best = null;
    for (const b of q) { if (b.id === a.id || used.has(b.id)) continue; const gap = Math.abs(a.rating - b.rating); if (gap <= gapFor(now - Math.min(a.since, b.since)) && (!best || gap < Math.abs(a.rating - best.rating))) best = b; }
    if (best) { used.add(a.id); used.add(best.id); pairs.push([a, best]); }
  }
  return pairs;
}

module.exports = { BASE_MS, START_GRACE_MS, START_RATING, elo, kFor, newRoom, sideOf, turnOf, clocks, tick, nextWake, move, resign, draw, decline, rematch, settle, view, gapFor, pairUp };
