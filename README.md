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
`index.html`, `app.js`, `worker.js`, `engine.js` (browser + Node) · `api/*.js` (Vercel functions, `@vercel/blob` storage) · `test/` (perft, arena, API, Playwright smoke)

## Run locally
```
npm i && node localserver.js   # http://localhost:8099, in-memory store
node test/perft.js && node test/api.js && node test/arena.js
```

## Deploy (Vercel)
Create a Blob store and set `CHESS_SECRET` (any long random string), then deploy this repo.
