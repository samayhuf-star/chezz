# Chezz

Play chess against **50 bot levels** with real clocks, and climb the city, state, country and world leaderboards.

## Features
- 50 bots in 5 tiers (Beginner → Master). The engine runs off the UI thread with a fixed node budget. Replies are paced to about one second so the clock is real.
- Time control: 7 minutes each side. Clocks start after both first moves; flagging loses the game.
- Guardrails: confirm-to-resign, free abort before move 2, illegal-move feedback with the reason, confirm before Undo/Hint (which make a game casual), draw offers the bot judges honestly, automatic draws (repetition, 50-move, stalemate, insufficient material), leave-page warning, resume after refresh (time away counts against your clock), offline results retried later.
- Drag-and-drop or tap-to-move, promotion picker, SAN move list, captured pieces, sound, PGN copy.
- Points: win = Level × 10, draw = Level × 4. A rating (Elo-style, starts at 800) is tracked on the server alongside points.
- Mobile app extras: real piece art (Chessnut, Apache 2.0) with move animation, move/capture/check/end sounds, post-game **review** (move grades, best-move highlight, accuracy, eval chart), **puzzles** (223 mate-in-1/2 puzzles, daily puzzle, streak), a face for each of the 50 bots, 6 board themes (2 free, 4 Pro), play and puzzle streaks, sound and haptics settings.
- Regenerate assets: `node mobile/scripts/gen-sfx.js`, `node mobile/scripts/gen-puzzles.js`. Tests: `node test/features.js`. See `docs/THIRD_PARTY.md` for asset licences.

## Engine and rules
Rules come from [chess.js](https://github.com/jhlywa/chess.js); every bot, hint and review runs on [Stockfish](https://github.com/official-stockfish/Stockfish) (the lite single-threaded WebAssembly build from the `stockfish` npm package). `core/` holds the shared code: `rules.js` (UCI moves on chess.js), `bot.js` (the 50 levels: node budget, number of candidate moves, how freely a level strays from the best one) and `sfdriver.js` (UCI driver). `node scripts/build-core.js` regenerates the bundles for the web app, the Cloudflare Worker and the Expo app.

## How ranked results are protected
The bot is deterministic: for a given game id, ply and level, a node-limited Stockfish search plus a seeded pick always gives the same move, on the phone, in the browser and on the server. When a game ends the client sends the move list to `/api/claim`; the server replays every move with chess.js, derives checkmate/stalemate/draw itself, re-computes a random sample of the bot's moves with Stockfish (always the first), rate-limits claims, and accepts each ticket only once.

## Licence
Chezz is free software under the GNU General Public License v3 (see `LICENSE`), because it includes Stockfish. Third-party components are listed in `docs/THIRD_PARTY.md`.

## Layout
`public/` (web app: `index.html`, `app.js`, `worker.js`, `engine.js`) · `api/*.js` (handlers) · `src/worker.mjs` + `wrangler.jsonc` (Cloudflare Worker: serves `public/` and `/api/*`, D1 storage) · `mobile/` (Expo iOS/Android app) · `test/`

## Run locally
```
npm i && node localserver.js            # http://localhost:8099 (in-memory store)
npx wrangler d1 execute chezz --local --file=schema.sql && npx wrangler dev --local   # full Worker + D1
npm test                                # core, API, auth, puzzles/analysis
node test/arena.js                      # bot strength ladder (slow)
node test/worker-e2e.js                 # against a running `wrangler dev --local --port 8799`
```

## Deploy on Cloudflare (one Worker for site + API)
The Worker serves `public/` and `/api/*`. Ranked games are stored in the D1 database named `chezz` (id in `wrangler.jsonc`, table `kv` from `schema.sql`).

```
npm ci
# one-time, if this account does not already have that D1 database:
#   npx wrangler d1 create chezz
# then put the printed database_id into wrangler.jsonc. Do not invent an id.
openssl rand -base64 32   # copy the value; do not commit it
export CHESS_SECRET='paste-that-value'
npm run deploy            # schema, wrangler deploy, then the secret
```

`npm run deploy:local` applies `schema.sql` to local D1 and runs `wrangler dev`. It expects a gitignored `.dev.vars` containing `CHESS_SECRET=...`.

Accounts and secrets this deploy needs (none of these are in the repo):

| What | Where it goes | Notes |
|---|---|---|
| Cloudflare account | `npx wrangler login`, or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | The token needs Workers and D1 edit on the account that owns database `chezz`. |
| `CHESS_SECRET` | Worker secret, via the deploy script | Long random string. Signs game tickets. The API returns "Server not configured" until it is set. |
| D1 database `chezz` | `database_id` already in `wrangler.jsonc` | Create it with `wrangler d1 create chezz` only if that id is not in this account, then commit the new id. |

Mobile builds read `EXPO_PUBLIC_API_URL` (set in `mobile/eas.json` to `https://chezz.samayhuf.workers.dev`). Privacy and support pages are the same origin: `/privacy.html`, `/terms.html`, `/support.html`.

### Alternate: Vercel
`api/` plus `public/` also run on Vercel, with storage in Vercel Blob instead of D1. From a linked Vercel project:

```
npx vercel deploy --prod
```

Set these in the Vercel project (do not commit them): `CHESS_SECRET`, and `BLOB_READ_WRITE_TOKEN` from a Blob store. Leave `STORE` unset. Point `EXPO_PUBLIC_API_URL` at that deployment if you use this path instead of the Worker.

## First iOS build
From `mobile/`:

```
npx eas-cli build --platform ios --profile production
```

`eas.json` uses remote app versioning, and the production profile has `autoIncrement`. The Expo account owner in `app.json` is `krosz`. The iOS bundle id and Android package are `com.samayvashsht.chezz`.

Set these on the EAS **production** environment before that build. They are RevenueCat public SDK keys (the values that start with `appl_` and `goog_`), not the RevenueCat secret API key. Do not commit them:

```
npx eas-cli env:create --name EXPO_PUBLIC_RC_IOS_KEY --value <RevenueCat Apple SDK key> --environment production --visibility sensitive
npx eas-cli env:create --name EXPO_PUBLIC_RC_ANDROID_KEY --value <RevenueCat Google SDK key> --environment production --visibility sensitive
```

`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_PRIVACY_URL` are already set in `mobile/eas.json`.

The paywall reads the current RevenueCat offering. Create these auto-renewable products and attach both to the RevenueCat entitlement `pro` and to that offering (monthly package and annual package):

| Store | Product ID | Period | Intended US price |
|---|---|---|---|
| App Store Connect, subscription group Chezz Pro | `chezz_pro_monthly` | 1 month | $3.99 |
| App Store Connect, subscription group Chezz Pro | `chezz_pro_yearly` | 1 year | $24.99 |
| Play Console | `chezz_pro_monthly` | monthly base plan | $3.99 |
| Play Console | `chezz_pro_yearly` | yearly base plan | $24.99 |
