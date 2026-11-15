// Tests for the puzzle set, the analysis function used by game review, and the sound/piece assets. Run: node test/features.js
const fs = require('fs'), path = require('path'), E = require('../public/engine.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const find = (G, n) => E.legalMoves(G, false).find(m => E.moveName(m) === n);
const isMate = G => E.inCheck(G) && E.legalMoves(G, false).length === 0;

// 1. every puzzle is a real forced mate with the stored first move
const P = require('../mobile/src/puzzles.json'); let bad = 0, dup = new Set();
for (const p of P) {
  const G = E.newGame(); E.setupFEN(G, p.f); const m = find(G, p.s); if (!m) { bad++; continue; }
  dup.add(p.f.split(' ')[0]); E.make(G, m);
  if (p.n === 1) { if (!isMate(G)) bad++; } else {
    const r = find(G, p.r); if (!r) { bad++; continue; } E.make(G, r);
    if (!E.legalMoves(G, false).some(x => { E.make(G, x); const k = isMate(G); E.unmake(G); return k; })) bad++;
  }
}
ok('puzzles: ' + P.length + ' puzzles, all valid forced mates', P.length >= 150 && bad === 0);
ok('puzzles: no duplicate positions', dup.size === P.length);

// 2. analyze: finds mate in 1, scores a hanging queen as a big loss, and leaves the game state untouched
let G = E.newGame(); E.setupFEN(G, 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
const before = E.fen(G), a = E.analyze(G, 4, 60000);
ok('analyze finds Qxf7#', E.moveName(a.move) === 'h5f7' && a.score >= E.MATE - 3);
ok('analyze leaves the position unchanged', E.fen(G) === before);
G = E.newGame(); E.setupFEN(G, 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
const b = E.analyze(G, 3, 30000), bad2 = b.all.find(x => E.moveName(x[1]) === 'f3h4');
ok('analyze grades Nxh4 as winning material', !!bad2 && bad2[0] > 300);
ok('analyze returns every legal move', b.all.length === E.legalMoves(G, false).length);
ok('analyze handles a finished game', E.analyze((() => { const g = E.newGame(); E.setupFEN(g, '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); return g; })(), 3, 1000).move === 0);

// 3. bot moves are unchanged (anti-cheat determinism): same input, same output, before and after analysis
G = E.newGame(); const m1 = E.think(G, 20, 12345); E.analyze(G, 3, 5000); ok('think() stays deterministic after analyze()', E.think(G, 20, 12345) === m1);

// 4. assets exist
const pcs = fs.readFileSync(path.join(__dirname, '../mobile/src/pieces.js'), 'utf8'); ok('12 piece graphics', (pcs.match(/"[wb][KQRBNP]":/g) || []).length === 12);
ok('7 sound effects', fs.readdirSync(path.join(__dirname, '../mobile/assets/sfx')).filter(f => f.endsWith('.wav')).length === 7);
process.exit(fails ? 1 : 0);
