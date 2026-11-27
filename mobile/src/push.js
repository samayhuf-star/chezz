// Push notifications through OneSignal. Nothing happens in a build without an app id.
// Consent is required before OneSignal sends or collects anything: the player opts in on the
// onboarding "Game reminders" screen (or later in Settings), and the choice is stored locally.
import { OneSignal } from 'react-native-onesignal';
import { ONESIGNAL_APP_ID } from './config';
import { load, save } from './storage';

let ready = false;
export function initPush() {
  if (ready || !ONESIGNAL_APP_ID) return false;
  try {
    OneSignal.setConsentRequired(true);
    OneSignal.initialize(ONESIGNAL_APP_ID);
    ready = true;
  } catch (e) { return false; }
  load('pushConsent', false).then(c => { if (c) { try { OneSignal.setConsentGiven(true); } catch (e) {} } });
  return true;
}
export const getPushConsent = () => load('pushConsent', false);
export async function setPushConsent(given) {
  await save('pushConsent', !!given);
  if (!ready) initPush();
  if (!ready) return;
  try {
    OneSignal.setConsentGiven(!!given);
    if (given) { await save('pushAsked', true); await OneSignal.Notifications.requestPermission(true); }
  } catch (e) {}
}
// Tie the device to the player so a message can reach one person (season results, a rival passing you).
export function pushLogin(id) { if (ready && id) { try { OneSignal.login(String(id)); } catch (e) {} } }
export function pushLogout() { if (ready) { try { OneSignal.logout(); } catch (e) {} } }
export function pushTags(tags) { if (ready && tags) { try { OneSignal.User.addTags(tags); } catch (e) {} } }
// Ask for the iOS permission once, after a finished game, and only if the player opted in.
export async function askPushOnce() {
  if (!ready || !(await load('pushConsent', false)) || (await load('pushAsked', false))) return;
  await save('pushAsked', true);
  try { await OneSignal.Notifications.requestPermission(true); } catch (e) {}
}
