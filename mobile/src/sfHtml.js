// The page the hidden WebView runs: Stockfish (WebAssembly) on the WebView's own thread, speaking UCI lines
// over postMessage. The app side drives it with the shared core driver, exactly like the web app and the server.
import { GLUE, WASM_B64 } from './sfAssets';

const BRIDGE = `
(function () {
  var out = function (l) { window.ReactNativeWebView.postMessage(l); };
  try {
    var factory = document.scripts[0]._exports, b = atob(${JSON.stringify(WASM_B64)}), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    var M = { wasmBinary: u.buffer, listener: out }, q = [], early = [], up = false;
    var run = function (c) { M.ccall('command', null, ['string'], [c], { async: /^go\\b/.test(c) }); };
    var drain = function () { while (q.length && !(M._isSearching && M._isSearching())) run(q.shift()); };
    var cmd = function (c) { c = c.trim(); if (/^(go|setoption)\\b/.test(c)) q.push(c); else run(c); drain(); };
    var boot = function () { if (M._isReady && !M._isReady()) return setTimeout(boot, 10); M.onDoneSearching = function () { setTimeout(drain, 1); }; up = true; early.splice(0).forEach(cmd); out('chezz-ready'); };
    var onMsg = function (ev) { if (typeof ev.data !== 'string') return; if (up) cmd(ev.data); else early.push(ev.data); };
    document.addEventListener('message', onMsg); window.addEventListener('message', onMsg);
    factory(M).then(boot).catch(function (e) { out('chezz-error ' + e); });
  } catch (e) { out('chezz-error ' + e); }
})();`;
export const SF_HTML = '<!DOCTYPE html><html><body><script>' + GLUE + '</script><script>' + BRIDGE + '</script></body></html>';
