#!/usr/bin/env bash
# Builds the web app into web-dist/: the Expo app's browser build, the Stockfish worker files and the policy pages.
# The Cloudflare Worker serves this folder (see wrangler.jsonc).
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -d node_modules/esbuild ]] || npm ci
node scripts/build-core.js
[[ -d mobile/node_modules/expo ]] || (cd mobile && npm ci)
rm -rf web-dist
(cd mobile && EXPO_PUBLIC_API_URL= npx expo export -p web --output-dir ../web-dist)
cp -R public/. web-dist/
echo "web-dist ready: $(du -sh web-dist | cut -f1)"
