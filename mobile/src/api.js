import { API_URL } from './config';
export const apiEnabled = () => !!API_URL;
export async function api(path, body, method = 'POST') {
  if (!API_URL) { const e = new Error('Online rankings are not available yet'); e.status = 0; e.offline = true; throw e; }
  let r;
  try { r = await fetch(API_URL + '/api/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) }); }
  catch (err) { const e = new Error('You appear to be offline'); e.status = 0; e.offline = true; throw e; }
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || 'HTTP ' + r.status); e.status = r.status; throw e; }
  return j;
}
