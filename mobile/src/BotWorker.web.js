// Web build of the engine host (used by the browser preview of the app): Stockfish in a Web Worker served from /sf/.
import { forwardRef, useImperativeHandle, useMemo } from 'react';
import * as C from './core';
import { engineApi } from './BotWorker.js';

const BotWorker = forwardRef(function BotWorker(_, ref) {
  const api = useMemo(() => {
    const w = new Worker('/sf/stockfish-19-lite-single.js');
    return engineApi(C.createDriver({ send: l => w.postMessage(l), onLine: fn => { w.onmessage = e => fn(e.data); } }));
  }, []);
  useImperativeHandle(ref, () => api, [api]);
  return null;
});
export default BotWorker;
