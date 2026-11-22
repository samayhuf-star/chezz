#!/usr/bin/env bash
# Deploy the Chezz site and API: one Cloudflare Worker (public/ + /api/*) on D1.
# Secrets are read from the environment only. This script never prints them
# and does not accept them as arguments.
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL=0
if [[ "${1:-}" == "--local" ]]; then
  LOCAL=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: scripts/deploy-cloudflare.sh [--local]" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Node.js with npx is required." >&2
  exit 1
fi

if [[ ! -d node_modules/wrangler ]]; then
  npm ci
fi

echo "Building the web app (web-dist/)..."
bash scripts/build-web.sh

if [[ "$LOCAL" == 1 ]]; then
  if [[ ! -f .dev.vars ]]; then
    echo "Create a gitignored .dev.vars file with CHESS_SECRET before running locally." >&2
    echo "Generate a value with: openssl rand -base64 32" >&2
    echo "Then: printf 'CHESS_SECRET=%s\n' \"\$CHESS_SECRET\" > .dev.vars" >&2
    exit 1
  fi
  npx wrangler d1 execute chezz --local --file=schema.sql
  exec npx wrangler dev --local
fi

if [[ -z "${CHESS_SECRET:-}" ]]; then
  echo "CHESS_SECRET is not set. Export a long random string, then re-run." >&2
  echo "Generate one with: openssl rand -base64 32" >&2
  echo "Do not pass the secret as a command-line argument." >&2
  exit 1
fi

echo "Checking Cloudflare auth (wrangler whoami)..."
npx wrangler whoami

echo "Applying schema.sql to the remote D1 database named in wrangler.jsonc..."
npx wrangler d1 execute chezz --remote --file=schema.sql

echo "Deploying the Worker..."
npx wrangler deploy

echo "Setting CHESS_SECRET on the Worker (value is not printed)..."
printf '%s' "$CHESS_SECRET" | npx wrangler secret put CHESS_SECRET

echo "Deployed. The mobile app expects EXPO_PUBLIC_API_URL=https://chezz.samayhuf.workers.dev"
echo "If wrangler printed a different workers.dev hostname, set EXPO_PUBLIC_API_URL to that origin."
