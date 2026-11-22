// Public configuration. Set these as EAS environment variables (EXPO_PUBLIC_*) in expo.dev.
// In the browser build the API is the site the page came from.
const WEB_ORIGIN = typeof window !== 'undefined' && window.location && /^https?:/.test(window.location.origin || '') ? window.location.origin : '';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || WEB_ORIGIN).replace(/\/$/, '');
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';
export const ENTITLEMENT = 'pro';
// Create these auto-renewable subscription product IDs in App Store Connect and
// Play Console, then attach both to the RevenueCat entitlement above and to the
// current offering (MONTHLY package + ANNUAL package). The paywall shows the
// localized price and period returned by the store, not these list prices.
export const PRODUCTS = {
  monthly: 'chezz_pro_monthly', // 1 month, intended US price $3.99
  yearly: 'chezz_pro_yearly', // 1 year, intended US price $24.99
};
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chezz Pro
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://chezz.samayhuf.workers.dev/privacy.html';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_URL = 'https://chezz.samayhuf.workers.dev/support.html';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
export const FREE_ONLINE_PER_DAY = 5; // live games a day without Chezz Pro
export const SOURCE_URL = 'https://github.com/samayhuf-star/chezz';
export const GPL_URL = 'https://www.gnu.org/licenses/gpl-3.0.html';
