// The server's Stockfish. On Cloudflare the Worker entry (src/worker.mjs) provides a maker that builds a fresh
// engine from the WebAssembly module for each request; everywhere else (tests, local server, Vercel) it is the
// npm build running in Node.
module.exports = () => (globalThis.__SF_MAKE ? globalThis.__SF_MAKE() : require('../core/node-engine')());
