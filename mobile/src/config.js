// Public configuration. Set these as EAS environment variables (EXPO_PUBLIC_*) in expo.dev.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY || '';
export const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY || '';
export const ENTITLEMENT = 'pro';
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chezz Pro
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://samayhuf-star.github.io/chezz/privacy.html';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
