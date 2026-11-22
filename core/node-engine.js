// Stockfish for Node (tests and the local dev server): the lite single-threaded WebAssembly build from npm.
// The npm loader supports one engine per process, so this is a singleton.
const { createDriver } = require('./sfdriver');
let d = null;
module.exports = function nodeDriver() {
  if (d) return d;
  let fn = () => {};
  const keepFetch = globalThis.fetch; // the stockfish loader sets the global fetch to null in Node; put it back once loaded
  const eng = require('stockfish')('lite-single', l => fn(l));
  d = createDriver({ send: c => eng.processCommand(c), onLine: f => { fn = f; } });
  d.ready.then(() => { if (!globalThis.fetch) globalThis.fetch = keepFetch; });
  d.close = () => { try { eng.processCommand('quit'); } catch (e) {} try { eng.terminate(); } catch (e) {} };
  return d;
};
