// Generates mobile/src/puzzles.json: forced-mate puzzles found in engine self-play. Run: node scripts/gen-puzzles.js [target]
const fs = require('fs'), path = require('path'), E = require('../../public/engine.js');
const TARGET = +process.argv[2] || 220, MATE = E.MATE;
let seed = 987654321; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const seen = new Set(), out = [];
const placement = f => f.split(' ')[0];
let games = 0;
while (out.length < TARGET && games < 4000) {
  games++;
  const G = E.newGame(), lvl = 2 + Math.floor(rnd() * 9);
  for (let ply = 0; ply < 90; ply++) {
    const ms = E.legalMoves(G, false); if (!ms.length || E.outcome(G, [E.posKey(G)])) break;
    if (ply >= 14 && ply % 2 === 0) {
      const a = E.analyze(G, 4, 40000);
      if (a.all.length > 1 && a.score >= MATE - 3 && a.all[1][0] < MATE - 3) {
        const f = E.fen(G), pl = placement(f);
        if (!seen.has(pl)) {
          const n = a.score === MATE - 1 ? 1 : 2, m1 = a.move; let reply = null;
          const H = E.newGame(); E.setupFEN(H, f); const sol = E.moveName(m1); E.make(H, m1);
          if (n === 2) { const d = E.analyze(H, 3, 40000); if (!d.move) continue; reply = E.moveName(d.move); }
          let pieces = 0; for (let i = 0; i < 128; i++) { if (i & 0x88) { i += 7; continue; } if (G.b[i]) pieces++; }
          seen.add(pl); out.push({ f, s: sol, r: reply, n, p: pieces });
        }
      }
    }
    // varied, error-prone play so that tactics appear
    const mv = (ply < 8 || rnd() < 0.12) ? ms[Math.floor(rnd() * ms.length)] : E.think(G, lvl, Math.floor(rnd() * 1e9));
    E.make(G, mv);
  }
}
out.sort((a, b) => a.n - b.n || b.p - a.p);
fs.writeFileSync(path.join(__dirname, '../src/puzzles.json'), JSON.stringify(out));
console.log('games', games, 'puzzles', out.length, 'mate1', out.filter(x => x.n === 1).length, 'mate2', out.filter(x => x.n === 2).length);
