// Public configuration. Set these as EAS environment variables (EXPO_PUBLIC_*) in expo.dev.
// In the browser build the API is the site the page came from.
const WEB_ORIGIN = typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin || '') ? window.location.origin : '';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || WEB_ORIGIN).replace(/\/$/, '');
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';
export const ENTITLEMENT = 'pro';
// Standard plans (Samay, 22 Nov 2026): 7-day free trial on every subscription, then
// weekly $2.99, monthly $5.99, yearly $29.99, plus a one-time lifetime purchase at $39.99.
// Each product is attached to the RevenueCat entitlement above and to the current offering
// (WEEKLY, MONTHLY, ANNUAL and LIFETIME packages).
// The paywall shows the localized price and period returned by the store, not these list prices.
export const PRODUCTS = {
  weekly: 'chezz_pro_weekly',
  monthly: 'chezz_pro_monthly',
  yearly: 'chezz_pro_yearly',
  lifetime: 'chezz_pro_lifetime',
};
export const TRIAL_DAYS = 7;
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chesz Pro
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://chezz.samayhuf.workers.dev/privacy.html';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_URL = 'https://chezz.samayhuf.workers.dev/support.html';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '';
export const FREE_ONLINE_PER_DAY = 5; // live games a day without Chesz Pro
export const SOURCE_URL = 'https://github.com/samayhuf-star/chezz';
export const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
