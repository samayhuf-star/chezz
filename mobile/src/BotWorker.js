// Stockfish for the app. It runs inside a hidden WebView (WebAssembly with JIT), so the UI never freezes.
// Exposes: think(moves, level, gameId) -> uci, analyse({moves|fen, nodes, mpv}) -> {lines, best}, acceptsDraw(moves, level).
import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as C from './core';
import { SF_HTML } from './sfHtml';

export function engineApi(driver) {
  return {
    think: (moves, level, gameId) => C.botMove(driver, moves, level, gameId),
    analyse: opts => driver.search(opts),
    acceptsDraw: (moves, level) => C.botAcceptsDraw(driver, moves, level),
  };
}
const BotWorker = forwardRef(function BotWorker(_, ref) {
  const web = useRef(null), onLine = useRef(() => {}), early = useRef([]), up = useRef(false);
  const api = useMemo(() => engineApi(C.createDriver({
    send: l => (up.current && web.current ? web.current.postMessage(l) : early.current.push(l)),
    onLine: fn => { onLine.current = fn; },
  })), []);
  useImperativeHandle(ref, () => api, [api]);
  const onMessage = e => {
    const l = e.nativeEvent.data;
    if (l === 'chezz-ready') { up.current = true; early.current.splice(0).forEach(x => web.current && web.current.postMessage(x)); }
    else if (typeof l === 'string' && l.startsWith('chezz-error')) console.warn(l);
    else onLine.current(l);
  };
  return (
    <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
      <WebView ref={web} originWhitelist={['*']} source={{ html: SF_HTML }} javaScriptEnabled onMessage={onMessage} />
    </View>
  );
});
export default BotWorker;
