// OneSignal push for optional game reminders and new-bot news. Consent is required before
// OneSignal sends or collects anything; the player opts in on the onboarding "Reminders" screen
// (or later in Profile), and the choice is stored locally.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OneSignal } from 'react-native-onesignal';

const APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;
const KEY = 'chezz.push.consent.v1';
let started = false;

export async function initPush() {
  if (started || !APP_ID) return;
  try {
    OneSignal.setConsentRequired(true);
    OneSignal.initialize(APP_ID);
    started = true;
    if ((await AsyncStorage.getItem(KEY)) === '1') OneSignal.setConsentGiven(true);
  } catch { /* push is optional: never block the game */ }
}

export async function getPushConsent(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) === '1'; } catch { return false; }
}

export async function setPushConsent(given: boolean) {
  try {
    await AsyncStorage.setItem(KEY, given ? '1' : '0');
    if (!started) await initPush();
    if (!started) return;
    OneSignal.setConsentGiven(given);
    if (given) await OneSignal.Notifications.requestPermission(true);
  } catch { /* ignore */ }
}
