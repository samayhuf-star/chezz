// One Cloudflare Worker: the web app (web-dist/, served by the assets binding), the /api/* handlers and live games.
import profile from '../api/profile.js';
import newGame from '../api/new.js';
import claim from '../api/claim.js';
import leaderboard from '../api/leaderboard.js';
import auth from '../api/auth.js';
import sfFactory from './sf-factory.mjs';
import sfWasm from './sf.wasm';
import core from '../core/index.js';
export { Lobby, GameRoom } from './live.mjs';
// A fresh Stockfish per claim: the wasm module is compiled once by the runtime, instantiating it is cheap.
globalThis.__SF_MAKE = () => core.createDriver(core.moduleLink(sfFactory, {
  instantiateWasm(imports, done) { const inst = new WebAssembly.Instance(sfWasm, imports); done(inst, sfWasm); return inst.exports; },
}));
const routes = { '/api/profile': profile, '/api/new': newGame, '/api/claim': claim, '/api/leaderboard': leaderboard, '/api/auth': auth };

export default {
  async fetch(request, env) {
    const url = new URL(request.url), fn = routes[url.pathname];
    // live games: WebSockets handled by Durable Objects (one lobby, one room per game)
    if (url.pathname === '/api/live/queue') return env.LOBBY.get(env.LOBBY.idFromName('main')).fetch(request);
    const room = /^\/api\/live\/game\/([a-f0-9]{16})$/.exec(url.pathname);
    if (room) return env.ROOM.get(env.ROOM.idFromName(room[1])).fetch(request);
    if (!fn) { // static files: the browser build of the app (web-dist/) plus the policy pages
      if (!env.ASSETS) return new Response('Not found', { status: 404 });
      if (url.pathname === '/') { url.pathname = '/index.html'; return env.ASSETS.fetch(new Request(url, request)); }
      return env.ASSETS.fetch(request);
    }
    globalThis.__DB = env.DB;
    if (env.CHESS_SECRET) process.env.CHESS_SECRET = env.CHESS_SECRET;
    let body = {};
    if (request.method === 'POST') { try { body = await request.json(); } catch (e) { body = {}; } }
    const query = Object.fromEntries(url.searchParams);
    return new Promise(resolve => {
      const headers = { 'content-type': 'application/json' };
      let code = 200;
      const res = {
        status(c) { code = c; return this; },
        setHeader(k, v) { headers[k.toLowerCase()] = v; },
        json(o) { resolve(new Response(JSON.stringify(o), { status: code, headers })); },
      };
      Promise.resolve(fn({ method: request.method, body, query }, res)).catch(() => resolve(new Response('{"error":"Server error"}', { status: 500, headers })));
    });
  },
};
