// One Cloudflare Worker: static site (public/, served by the assets binding) + the /api/* handlers.
import profile from '../api/profile.js';
import newGame from '../api/new.js';
import claim from '../api/claim.js';
import leaderboard from '../api/leaderboard.js';
import auth from '../api/auth.js';
const routes = { '/api/profile': profile, '/api/new': newGame, '/api/claim': claim, '/api/leaderboard': leaderboard, '/api/auth': auth };

export default {
  async fetch(request, env) {
    const url = new URL(request.url), fn = routes[url.pathname];
    if (!fn) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
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
