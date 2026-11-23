// End-to-end against a running Worker (npx wrangler dev --local --port 8799): the bot moves computed here in Node
// must be accepted by Stockfish running inside the Worker, and a tampered bot move must be rejected.
const F = globalThis.fetch, C = require('../core'), d = require('../core/node-engine')(), base = process.argv[2] || 'http://localhost:8799';
const post = async (m, body) => { const r = await F(base + '/api/' + m, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { c: r.status, o: await r.json() }; };
let bad = 0; const ok = (n, c) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
(async () => {
  const p = await post('profile', { name: 'E2E ' + Date.now() % 10000, city: 'Ghaziabad', state: 'UP', country: 'India' }), auth = { id: p.o.id, secret: p.o.secret };
  ok('profile created on the Worker', p.c === 200 && !!auth.id);
  async function game(level, human, stopAt) {
    const n = await post('new', { ...auth, level, human }), moves = [], chess = new C.Chess();
    while (!C.outcome(chess) && moves.length < stopAt) {
      const m = (chess.turn() === 'w') === (human === 1) ? C.legalUci(chess)[(moves.length * 7) % C.legalUci(chess).length] : await C.botMove(d, moves, level, n.o.g);
      moves.push(m); C.play(chess, m);
    }
    return { token: n.o.token, moves };
  }
  for (const [lv, human, plies] of [[3, 1, 16], [22, -1, 21], [50, 1, 8]]) {
    const g = await game(lv, human, plies), t = Date.now(), c = await post('claim', { ...auth, token: g.token, moves: g.moves, end: 'resign' });
    ok('level ' + lv + ': Worker re-checked ' + plies + ' plies and agreed (' + (Date.now() - t) + ' ms) ' + (c.o.error || ''), c.c === 200 && c.o.result === 'l');
  }
  const g = await game(12, 1, 10), bm = g.moves.slice(0, 2); bm[1] = C.legalUci(C.replay(bm.slice(0, 1)).chess).find(m => m !== bm[1]);
  const c = await post('claim', { ...auth, token: g.token, moves: bm, end: 'resign' });
  ok('tampered bot move rejected by the Worker: ' + c.o.error, c.c === 400 && /mismatch/.test(c.o.error));
  d.close(); process.exit(bad ? 1 : 0);
})();
