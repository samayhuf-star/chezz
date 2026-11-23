// Strength ladder: each pair of levels plays a short match (colours alternate). Higher level should score more.
const C = require('../core'), d = require('../core/node-engine')();
const pairs = (process.argv[2] || '1:6,6:12,12:20,20:30,30:40,40:50').split(',').map(p => p.split(':').map(Number)), N = +(process.argv[3] || 6);
(async () => {
  let bad = 0;
  for (const [lo, hi] of pairs) {
    let score = 0, plies = 0;
    for (let g = 0; g < N; g++) {
      const hiWhite = g % 2 === 0, moves = [], chess = new C.Chess(), id = 'arena' + lo + '-' + hi + '-' + g;
      let o = null;
      while (!(o = C.outcome(chess)) && moves.length < 240) { const lv = (moves.length % 2 === 0) === hiWhite ? hi : lo, m = await C.botMove(d, moves, lv, id); C.play(chess, m); moves.push(m); }
      score += !o || o.r === 'd' ? 0.5 : (o.r === 'w') === hiWhite ? 1 : 0; plies += moves.length;
    }
    console.log('Level ' + hi + ' vs Level ' + lo + ': ' + score + ' / ' + N + '  (avg ' + Math.round(plies / N) + ' plies)'); if (score <= N / 2) bad++;
  }
  d.close(); process.exit(bad ? 1 : 0);
})();
