// Runs the chess engine inside a hidden WebView (JavaScriptCore with JIT), so the UI never freezes
// and even Level 50 answers in a fraction of a second.
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import ENGINE from './engineSource';
import * as Local from './engine';

const HTML = '<!DOCTYPE html><html><body><script>' + ENGINE + '</script><script>' +
  'function onMsg(ev){try{var d=JSON.parse(ev.data),r=Chezz.replay(d.moves),m=0;if(r)m=Chezz.think(r.G,d.level,d.seed);' +
  'window.ReactNativeWebView.postMessage(JSON.stringify({id:d.id,move:m}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({id:0,err:String(e)}));}}' +
  'document.addEventListener("message",onMsg);window.addEventListener("message",onMsg);' +
  'window.ReactNativeWebView.postMessage(JSON.stringify({ready:1}));</script></body></html>';

let nextId = 1;
const BotWorker = forwardRef(function BotWorker(_, ref) {
  const web = useRef(null), ready = useRef(false), pending = useRef({});
  useImperativeHandle(ref, () => ({
    think(moves, level, seed) {
      return new Promise(resolve => {
        const id = nextId++;
        let done = false;
        const finish = m => { if (!done) { done = true; delete pending.current[id]; resolve(m); } };
        pending.current[id] = finish;
        // safety net: if the worker is missing or slow, compute on the JS thread (same engine, same answer)
        setTimeout(() => { if (!done) { const r = Local.replay(moves); finish(r ? Local.think(r.G, level, seed) : 0); } }, ready.current ? 6000 : 1500);
        if (web.current && ready.current) web.current.postMessage(JSON.stringify({ id, moves, level, seed }));
      });
    },
  }));
  return (
    <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
      <WebView ref={web} originWhitelist={['*']} source={{ html: HTML }} javaScriptEnabled
        onMessage={e => { try { const d = JSON.parse(e.nativeEvent.data); if (d.ready) ready.current = true; else if (d.id && pending.current[d.id]) pending.current[d.id](d.move); } catch (x) {} }} />
    </View>
  );
});
export default BotWorker;
