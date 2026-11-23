// Tests for the puzzle set, Stockfish analysis used by hints and game review, and the sound/piece assets. Run: node test/features.js
const fs = require('fs'), path = require('path'), C = require('../core'), sf = require('../core/node-engine')();
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
(async () => {
// 1. every puzzle is a real forced mate with the stored first move
const P = require('../mobile/src/puzzles.json'); let bad = 0, dup = new Set();
for (const p of P) {
  const ch = new C.Chess(p.f); dup.add(p.f.split(' ')[0]);
  if (!C.play(ch, p.s)) { bad++; continue; }
  if (p.n === 1) { if (!ch.isCheckmate()) bad++; } else {
    if (!C.play(ch, p.r)) { bad++; continue; }
    if (!C.legalUci(ch).some(x => { C.play(ch, x); const k = ch.isCheckmate(); ch.undo(); return k; })) bad++;
  }
}
ok('puzzles: ' + P.length + ' puzzles, all valid forced mates', P.length >= 150 && bad === 0);
ok('puzzles: no duplicate positions', dup.size === P.length);

// 2. Stockfish analysis: finds mate in 1 and sees a hanging queen
let a = await sf.search({ fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', nodes: 12000, mpv: 1 });
ok('analysis finds Qxf7#', a.best === 'h5f7' && a.lines[0].cp >= C.MATE - 3);
a = await sf.search({ fen: 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', nodes: 12000, mpv: 1 });
ok('analysis takes the hanging queen (Nxh4) and scores it as winning', a.best === 'f3h4' && a.lines[0].cp > 300);

// 3. bot moves are unchanged (anti-cheat determinism): same input, same output, before and after analysis
const m1 = await C.botMove(sf, ['e2e4', 'c7c5'], 20, 'feat'); ok('bot move stays the same after other analysis', (await C.botMove(sf, ['e2e4', 'c7c5'], 20, 'feat')) === m1);

// 4. assets exist
const pcs = fs.readFileSync(path.join(__dirname, '../mobile/src/pieces.js'), 'utf8'); ok('12 piece graphics', (pcs.match(/"[wb][KQRBNP]":/g) || []).length === 12);
ok('7 sound effects', fs.readdirSync(path.join(__dirname, '../mobile/assets/sfx')).filter(f => f.endsWith('.wav')).length === 7);
sf.close(); process.exit(fails ? 1 : 0);
})();
