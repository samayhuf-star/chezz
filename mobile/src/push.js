// Push notifications through OneSignal. Nothing happens in a build without an app id.
import { OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from './config';
import { load, save } from './storage';

let ready = false;
export function initPush() {
  if (ready || !ONESIGNAL_APP_ID) return false;
  try { OneSignal.initialize(ONESIGNAL_APP_ID); ready = true; } catch (e) { return false; }
  return true;
}
// Tie the device to the player so a message can reach one person (season results, a rival passing you).
export function pushLogin(id) { if (ready && id) { try { OneSignal.login(String(id)); } catch (e) {} } }
export function pushLogout() { if (ready) { try { OneSignal.logout(); } catch (e) {} } }
export function pushTags(tags) { if (ready && tags) { try { OneSignal.User.addTags(tags); } catch (e) {} } }
// Ask once, after the player has finished a game, not on first launch.
export async function askPushOnce() {
  if (!ready || (await load('pushAsked', false))) return;
  await save('pushAsked', true);
  try { await OneSignal.Notifications.requestPermission(true); } catch (e) {}
}
