// WebSocket client for live games. The first message on every socket signs the player in.
import { API_URL } from './config';
export function openSocket(path, auth, onMsg, onClose, onOpen) {
  const ws = new WebSocket(API_URL.replace(/^http/, 'ws') + path);
  ws.onopen = () => { ws.send(JSON.stringify({ t: 'auth', ...auth })); if (onOpen) onOpen(); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
  ws.onclose = e => { if (onClose) onClose(e.code); };
  ws.onerror = () => {};
  return { send: o => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); }, close: () => { ws.onclose = null; try { ws.close(); } catch (e) {} } };
}
