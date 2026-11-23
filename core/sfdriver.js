// Talks UCI to one Stockfish instance. `link` is { send(line), onLine(fn) } so the same driver runs over a
// Web Worker, the WebView bridge, the Cloudflare Worker module and Node.
const MATE = 100000;

function createDriver(link) {
  let buf = [], waiter = null, chain = Promise.resolve();
  link.onLine(line => { if (typeof line !== 'string') return; buf.push(line); if (waiter && waiter.re.test(line)) { const w = waiter; waiter = null; w.done(buf.splice(0)); } });
  const ask = (cmd, re) => new Promise(done => { waiter = { re, done }; link.send(cmd); });
  const ready = ask('uci', /^uciok/);

  // One search at a time. Hash is cleared first so the answer depends only on the position and the node budget.
  async function search({ moves, fen, nodes, mpv = 1 }) {
    await ready;
    link.send('setoption name MultiPV value ' + mpv);
    link.send('ucinewgame');
    await ask('isready', /^readyok/);
    link.send(fen ? 'position fen ' + fen : 'position startpos' + (moves && moves.length ? ' moves ' + moves.join(' ') : ''));
    const out = await ask('go nodes ' + nodes, /^bestmove/), byIdx = {};
    for (const l of out) {
      const m = /^info .*?multipv (\d+) score (cp|mate) (-?\d+).* pv (\S+)/.exec(l);
      if (m && !/(lower|upper)bound/.test(l)) byIdx[m[1]] = { mv: m[4], cp: m[2] === 'cp' ? +m[3] : (+m[3] > 0 ? MATE - +m[3] : -MATE - +m[3]) };
    }
    const lines = Object.keys(byIdx).sort((a, b) => a - b).map(k => byIdx[k]);
    const bm = /^bestmove (\S+)/.exec(out[out.length - 1]);
    return { lines, best: bm && bm[1] !== '(none)' ? bm[1] : null };
  }
  // Callers may fire searches without waiting; they still run strictly one after another.
  const queued = opts => { const p = chain.then(() => search(opts)); chain = p.catch(() => {}); return p; };
  return { search: queued, ready };
}

// Wraps an Emscripten Stockfish module (built by its factory) as a link. Mirrors stockfish.js's own command queue:
// "go" and "setoption" wait until the current search is over.
function moduleLink(factory, config) {
  const M = Object.assign({}, config), early = [], q = [];
  let listener = () => {}, up = false;
  M.listener = l => listener(l);
  const run = c => M.ccall('command', null, ['string'], [c], { async: /^go\b/.test(c) });
  const drain = () => { while (q.length && !(M._isSearching && M._isSearching())) run(q.shift()); };
  const cmd = c => { c = c.trim(); if (/^(go|setoption)\b/.test(c)) q.push(c); else run(c); drain(); };
  const boot = () => { if (M._isReady && !M._isReady()) return setTimeout(boot, 10); M.onDoneSearching = () => setTimeout(drain, 1); up = true; early.splice(0).forEach(cmd); };
  Promise.resolve(factory(M)).then(boot);
  return { send: c => (up ? cmd(c) : early.push(c)), onLine: fn => { listener = fn; } };
}

module.exports = { createDriver, moduleLink, MATE };
