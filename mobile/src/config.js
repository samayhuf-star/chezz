// Public configuration. Set these as EAS environment variables (EXPO_PUBLIC_*) in expo.dev.
// In the browser build the API is the site the page came from.
const WEB_ORIGIN = typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin || '') ? window.location.origin : '';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || WEB_ORIGIN).replace(/\/$/, '');
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';
export const ENTITLEMENT = 'pro';
// Single plan (Samay, 17 Nov 2026): weekly subscription, 7-day free trial, then $1.99 per week.
// Create this auto-renewable subscription in App Store Connect and Play Console, attach it
// to the RevenueCat entitlement above and to the current offering (WEEKLY package).
// The paywall shows the localized price and period returned by the store, not this list price.
export const PRODUCTS = {
  weekly: 'chezz_pro_weekly', // 1 week, US price $1.99, 7-day free trial
};
export const TRIAL_DAYS = 7;
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chesz Pro
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://chezz.samayhuf.workers.dev/privacy.html';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_URL = 'https://chezz.samayhuf.workers.dev/support.html';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const FREE_ONLINE_PER_DAY = 5; // live games a day without Chezz Pro
export const SOURCE_URL = 'https://github.com/samayhuf-star/chezz';
export const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
