// Live player-vs-player games on Cloudflare Durable Objects.
//   Lobby    : one instance. Players wait here on a WebSocket until two with close ratings are paired.
//   GameRoom : one instance per game. Holds the moves and both clocks, checks every move with chess.js,
//              ends the game on mate / draw / resignation / time, and updates both online ratings.
// The game rules for a room live in core/live.js; this file is sockets, storage and alarms only.
import core from '../core/index.js';
import lib from '../api/_lib.js';

const L = core.live;
const useEnv = env => { globalThis.__DB = env.DB; if (env.CHESS_SECRET) process.env.CHESS_SECRET = env.CHESS_SECRET; };
const send = (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} };
const parse = ev => { try { const m = JSON.parse(ev.data); return m && typeof m === 'object' ? m : null; } catch (e) { return null; } };
function upgrade(request, onSocket) {
  if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
  const pair = new WebSocketPair(); pair[1].accept(); onSocket(pair[1]);
  return new Response(null, { status: 101, webSocket: pair[0] });
}
// The first message on every socket is { t: 'auth', id, secret }: the same player id and secret the HTTP API uses.
async function signedIn(env, m) { useEnv(env); const doc = await lib.loadPlayer(m.id); return lib.authOK(doc, m.secret) && doc.name ? doc : null; }
const ratingOf = d => (d.orating | 0) || L.START_RATING;

export class Lobby {
  constructor(state, env) { this.env = env; this.q = new Map(); this.timer = null; }
  async fetch(request) { return upgrade(request, ws => this.onSocket(ws)); }
  onSocket(ws) {
    let me = null;
    ws.addEventListener('message', async ev => {
      const m = parse(ev); if (!m) return;
      if (m.t === 'auth' && !me) {
        const doc = await signedIn(this.env, m);
        if (!doc) { send(ws, { t: 'error', error: 'Not signed in' }); return ws.close(4001, 'auth'); }
        const old = this.q.get(doc.id); if (old) { try { old.ws.close(4002, 'replaced'); } catch (e) {} }
        me = { id: doc.id, name: doc.name, country: doc.country || '', rating: ratingOf(doc), since: Date.now(), ws };
        this.q.set(me.id, me); send(ws, { t: 'queued', rating: me.rating, waiting: this.q.size });
        this.match();
      } else if (m.t === 'cancel') ws.close(1000, 'cancel');
    });
    const gone = () => { if (me && this.q.get(me.id) === me) this.q.delete(me.id); };
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
  }
  async match() {
    clearTimeout(this.timer);
    for (const [a, b] of L.pairUp([...this.q.values()], Date.now())) {
      this.q.delete(a.id); this.q.delete(b.id);
      const [w, bl] = crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? [a, b] : [b, a];
      const game = crypto.randomUUID().replace(/-/g, '').slice(0, 16), pub = p => ({ id: p.id, name: p.name, rating: p.rating, country: p.country });
      await this.env.ROOM.get(this.env.ROOM.idFromName(game)).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ w: pub(w), b: pub(bl) }) });
      send(w.ws, { t: 'match', game, color: 'w', opp: { name: bl.name, rating: bl.rating } });
      send(bl.ws, { t: 'match', game, color: 'b', opp: { name: w.name, rating: w.rating } });
      for (const p of [w, bl]) { try { p.ws.close(1000, 'matched'); } catch (e) {} }
    }
    // players too far apart keep waiting; the allowed gap widens with time, so look again shortly
    if (this.q.size >= 2) this.timer = setTimeout(() => this.match(), 2000);
  }
}

export class GameRoom {
  constructor(state, env) {
    this.state = state; this.env = env; this.g = null; this.socks = new Map(); // ws -> player id (colours swap on a rematch, so the side is looked up each time)
    state.blockConcurrencyWhile(async () => { this.g = (await state.storage.get('g')) || null; });
  }
  async save() {
    await this.state.storage.put('g', this.g);
    const wake = L.nextWake(this.g);
    if (wake) await this.state.storage.setAlarm(wake); else await this.state.storage.deleteAlarm();
  }
  broadcast() { const now = Date.now(); for (const [ws, pid] of this.socks) send(ws, L.view(this.g, L.sideOf(this.g, pid), now)); }
  async fetch(request) {
    if (new URL(request.url).pathname === '/init') { // only the Lobby can reach this path
      if (!this.g) { this.g = L.newRoom(await request.json(), Date.now(), +this.env.LIVE_BASE_MS || undefined); await this.save(); }
      return new Response('ok');
    }
    if (!this.g) return new Response('No such game', { status: 404 });
    return upgrade(request, ws => this.onSocket(ws));
  }
  // Runs once per finished game: new ratings and records for both players.
  async settle() {
    const g = this.g; if (!g.over || g.settled) return; g.settled = true; useEnv(this.env);
    const docs = { w: await lib.loadPlayer(g.players.w.id), b: await lib.loadPlayer(g.players.b.id) };
    const s = L.settle(g, { w: docs.w ? docs.w.ogames | 0 : 0, b: docs.b ? docs.b.ogames | 0 : 0 });
    g.result = { w: { rating: s.w, d: s.dw }, b: { rating: s.b, d: s.db } };
    if (g.aborted) return;
    for (const side of ['w', 'b']) {
      const d = docs[side]; if (!d) continue; // account deleted mid-game
      const r = g.over.r === 'd' ? 'd' : g.over.r === side ? 'w' : 'l', opp = g.players[side === 'w' ? 'b' : 'w'];
      d.orating = g.result[side].rating; d.opeak = Math.max(d.opeak | 0, d.orating); d.ogames = (d.ogames | 0) + 1;
      d['o' + r] = (d['o' + r] | 0) + 1;
      d.orecent = [{ opp: opp.name, or: opp.rating, r, why: g.over.why, dr: g.result[side].d, c: side, p: g.moves.length, ts: Date.now() }].concat(d.orecent || []).slice(0, 20);
      d.updated = Date.now(); await lib.savePlayer(d);
    }
  }
  onSocket(ws) {
    let pid = null;
    ws.addEventListener('message', async ev => {
      const m = parse(ev); if (!m) return; const g = this.g, now = Date.now();
      if (m.t === 'auth') {
        const doc = await signedIn(this.env, m), seat = doc ? L.sideOf(g, doc.id) : null;
        if (!seat) { send(ws, { t: 'error', error: 'You are not a player in this game' }); return ws.close(4001, 'auth'); }
        pid = doc.id; this.socks.set(ws, pid);
        if (L.tick(g, now)) { await this.settle(); await this.save(); return this.broadcast(); }
        return send(ws, L.view(g, seat, now));
      }
      if (!pid) return;
      const side = L.sideOf(g, pid);
      let r;
      if (m.t === 'move') r = L.move(g, side, String(m.uci), now);
      else if (m.t === 'resign') r = L.resign(g, side, now);
      else if (m.t === 'draw') r = L.draw(g, side, now);
      else if (m.t === 'decline') r = L.decline(g, side);
      else if (m.t === 'rematch') r = L.rematch(g, side, now, g.result ? { [g.players.w.id]: g.result.w.rating, [g.players.b.id]: g.result.b.rating } : null);
      else return;
      if (r.error) return send(ws, { t: 'error', error: r.error });
      await this.settle(); await this.save(); this.broadcast();
    });
    const gone = () => this.socks.delete(ws);
    ws.addEventListener('close', gone); ws.addEventListener('error', gone);
  }
  async alarm() {
    if (!this.g) return;
    if (L.tick(this.g, Date.now())) await this.settle();
    await this.save(); this.broadcast();
  }
}
