// Two real WebSocket clients against a running Worker (npx wrangler dev --local --port 8799):
// matchmaking, a full game, server-side move checks, ratings, rematch, and a time-out with a short clock.
// Start the Worker with LIVE_BASE_MS=3000 in .dev.vars to run the time-out part.
const base = process.argv[2] || 'http://localhost:8799', wsBase = base.replace(/^http/, 'ws');
let bad = 0; const ok = (n, c) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
const post = async (m, body) => (await fetch(base + '/api/' + m, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
function client(path, auth) {
  const ws = new WebSocket(wsBase + path), got = [], waiters = [];
  ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', ...auth }));
  ws.onmessage = e => { const m = JSON.parse(e.data); got.push(m); for (const w of waiters.splice(0)) if (w.test(m)) w.done(m); else waiters.push(w); };
  return { ws, got, send: o => ws.send(JSON.stringify(o)), last: () => got[got.length - 1],
    next: (test, ms = 8000) => new Promise((done, fail) => { const hit = got.find(test); if (hit && !test.fresh) return done(hit); waiters.push({ test, done }); setTimeout(() => fail(new Error('timeout waiting for message')), ms); }) };
}
const fresh = f => { f.fresh = true; return f; };
(async () => {
  const mk = async name => { const g = await post('auth', { mode: 'guest' }); await post('profile', { id: g.id, secret: g.secret, name, city: 'Ghaziabad', state: 'UP', country: 'India' }); return { id: g.id, secret: g.secret }; };
  const A = await mk('Alice' + Date.now() % 1000), B = await mk('Bob' + Date.now() % 1000);
  const qa = client('/api/live/queue', A); await qa.next(m => m.t === 'queued');
  const qb = client('/api/live/queue', B);
  const ma = await qa.next(m => m.t === 'match'), mb = await qb.next(m => m.t === 'match');
  ok('two players matched into one game, opposite colours', ma.game === mb.game && ma.color !== mb.color);
  const [W, Bl] = ma.color === 'w' ? [A, B] : [B, A];
  const w = client('/api/live/game/' + ma.game, W), b = client('/api/live/game/' + ma.game, Bl);
  const s0 = await w.next(m => m.t === 'state'); await b.next(m => m.t === 'state');
  ok('both start at 1000 with full clocks', s0.w.rating === 1000 && s0.clk[0] === s0.base && s0.you === 'w');
  b.send({ t: 'move', uci: 'e7e5' }); ok('moving out of turn is refused', (await b.next(m => m.t === 'error')).error === 'Not your turn');
  w.send({ t: 'move', uci: 'e2e5' }); ok('illegal move is refused', (await w.next(m => m.t === 'error')).error === 'Illegal move');
  const play = async (c, uci, n) => { c.send({ t: 'move', uci }); await w.next(fresh(m => m.t === 'state' && m.moves.length === n)); };
  await play(w, 'f2f3', 1); await play(b, 'e7e5', 2); await play(w, 'g2g4', 3);
  b.send({ t: 'move', uci: 'd8h4' });
  const end = await w.next(fresh(m => m.t === 'state' && m.over && m.result));
  ok('checkmate ends the game on the server: ' + end.over.why, end.over.r === 'b' && end.result.b.d > 0 && end.result.w.d < 0);
  const stranger = client('/api/live/game/' + ma.game, await mk('Eve')); ok('a third player cannot join the room', (await stranger.next(m => m.t === 'error')).error.includes('not a player'));
  await sleep(300);
  const dw = (await post('profile', W)).doc, db = (await post('profile', Bl)).doc;
  ok('online ratings and records saved for both players', db.orating === end.result.b.rating && db.ow === 1 && dw.orating === end.result.w.rating && dw.ol === 1 && dw.orecent.length === 1);
  w.send({ t: 'rematch' }); b.send({ t: 'rematch' });
  const s2 = await b.next(fresh(m => m.t === 'state' && m.n === 2));
  if (!(s2.you === 'w' && !s2.over && s2.w.rating === end.result.b.rating)) console.log(JSON.stringify(s2), JSON.stringify(end.result));
  ok('rematch: colours swapped, new ratings carried', s2.you === 'w' && !s2.over && s2.w.rating === end.result.b.rating);
  if (s2.base <= 5000) {
    b.send({ t: 'move', uci: 'e2e4' }); await w.next(fresh(m => m.t === 'state' && m.n === 2 && m.moves.length === 1));
    w.send({ t: 'move', uci: 'e7e5' });
    const flag = await w.next(fresh(m => m.t === 'state' && m.n === 2 && m.over), s2.base + 5000);
    ok('time-out: the server flags the player who is out of time (' + flag.over.why + ')', flag.over.r === 'b' && flag.over.why === 'Won on time');
  } else console.log('skip time-out test (LIVE_BASE_MS not set to a short clock)');
  for (const c of [qa, qb, w, b, stranger]) try { c.ws.close(); } catch (e) {}
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
