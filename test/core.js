// Core checks: rules via chess.js, and that bot moves repeat exactly on a fresh engine and on a reused one.
const C = require('../core'), nodeDriver = require('../core/node-engine');
let bad = 0; const ok = (n, c) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
(async () => {
  ok('fool\'s mate is checkmate for black', (o => o && o.r === 'b' && o.why === 'Checkmate')(C.outcome(C.replay(['f2f3', 'e7e5', 'g2g4', 'd8h4']).chess)));
  ok('illegal move rejected', C.replay(['e2e5']) === null);
  ok('promotion parsed', C.validUci('e7e8q') && !C.validUci('e7e8k'));
  ok('repetition draw', (o => o && o.r === 'd')(C.outcome(C.replay(['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8']).chess)));
  ok('50 levels, node budget rises', C.LV.length === 51 && C.LV[1].nodes < C.LV[25].nodes && C.LV[25].nodes < C.LV[50].nodes);
  const a = nodeDriver(), pos = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
  const first = {}; for (const l of [1, 7, 15, 28, 40, 50]) first[l] = await C.botMove(a, pos, l, 'abc123');
  for (const l of [50, 1, 28]) await C.botMove(a, ['d2d4', 'd7d5'], l, 'zzz'); // dirty the engine state
  let same = true; for (const l in first) if (await C.botMove(a, pos, +l, 'abc123') !== first[l]) same = false;
  ok('reused engine repeats its moves ' + JSON.stringify(first), same);
  // a brand-new engine in another process must agree (this is what the server does when it re-checks a game)
  const fresh = require('child_process').execFileSync(process.execPath, ['-e', `const C=require('./core'),d=require('./core/node-engine')();(async()=>{const o={};for(const l of [1,7,15,28,40,50])o[l]=await C.botMove(d,${JSON.stringify(pos)},l,'abc123');console.log(JSON.stringify(o));process.exit(0)})()`], { cwd: __dirname + '/..' }).toString().trim();
  ok('fresh engine in a new process gives the same moves', fresh === JSON.stringify(first));
  const t = Date.now(); await C.botMove(a, pos, 50, 'x'); ok('level 50 answers in ' + (Date.now() - t) + ' ms', Date.now() - t < 5000);
  ok('all bot moves legal', Object.values(first).every(m => C.legalUci(C.replay(pos).chess).includes(m)));
  a.close(); process.exit(bad ? 1 : 0);
})();
