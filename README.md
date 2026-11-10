# Chezz

Play chess against **50 bot levels** with real clocks, and climb the city, state, country and world leaderboards.

## Features
- 50 bots in 5 tiers (Beginner → Master). Bots answer instantly: the engine runs in a Web Worker with a fixed node budget instead of a timer.
- Time controls: no clock, 1, 3, 5, 10, 30 min and 3|2, 10|5, 15|10 increments. Clocks start after both first moves; flagging loses the game.
- Guardrails: confirm-to-resign, free abort before move 2, illegal-move feedback with the reason, confirm before Undo/Hint (which make a game casual), draw offers the bot judges honestly, automatic draws (repetition, 50-move, stalemate, insufficient material), leave-page warning, resume after refresh (time away counts against your clock), offline results retried later.
- Drag-and-drop or tap-to-move, promotion picker, SAN move list, captured pieces, sound, PGN copy.
- Points: win = Level × 10, draw = Level × 4.

## How ranked results are protected
The bot is deterministic: `think(position, level, seed)` always returns the same move, and the seed comes from a server-signed game ticket. When a game ends the browser sends the move list to `/api/claim`; the server re-plays every move for legality, derives checkmate/stalemate/draw itself, re-computes a random sample of the bot's moves (always the first), rate-limits claims, and accepts each ticket only once.

## Layout
`public/` (web app: `index.html`, `app.js`, `worker.js`, `engine.js`) · `api/*.js` (handlers) · `src/worker.mjs` + `wrangler.jsonc` (Cloudflare Worker: serves `public/` and `/api/*`, D1 storage) · `mobile/` (Expo iOS/Android app) · `test/`

## Run locally
```
npm i && node localserver.js            # http://localhost:8099 (in-memory store)
npx wrangler d1 execute chezz --local --file=schema.sql && npx wrangler dev --local   # full Worker + D1
node test/perft.js && node test/api.js && node test/arena.js
```

## Deploy on Cloudflare (one Worker for site + API)
The D1 database `chezz` already exists in the account (id is in `wrangler.jsonc`, table `kv` created).
1. Dashboard: Workers & Pages → Create → Import a repository → `samayhuf-star/chezz`. Build command empty, deploy command `npx wrangler deploy`.
2. Worker → Settings → Variables and Secrets → add secret `CHESS_SECRET` (any long random string).
3. Open the `*.workers.dev` URL. Put that URL in Expo as `EXPO_PUBLIC_API_URL` for the mobile app.
(or, from a terminal logged in with `wrangler login`: `npx wrangler secret put CHESS_SECRET && npx wrangler deploy`)

Vercel also works (`api/` + `public/`, `@vercel/blob`).
