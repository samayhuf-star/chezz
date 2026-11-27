// Public configuration. EXPO_PUBLIC_API_URL is set in eas.json for production builds.
const apiFromEnv: string = ((globalThis as { process?: { env?: { EXPO_PUBLIC_API_URL?: string } } }).process?.env?.EXPO_PUBLIC_API_URL) || '';
export const API_URL = apiFromEnv.replace(/\/$/, '');
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chezz Pro

// RevenueCat project "Chezz" (offering "default", entitlement "pro"). Prices come from the store.
export const ENTITLEMENT_ID = 'pro';

export const PRODUCT_IDS = {
  weekly: 'chezz_pro_weekly',
  monthly: 'chezz_pro_monthly',
  yearly: 'chezz_pro_yearly',
  lifetime: 'chezz_pro_lifetime',
} as const;

// Paywall order: annual first (best value). Package ids are RevenueCat defaults.
export const PRODUCT_CATALOG = [
  { id: PRODUCT_IDS.yearly, pkg: '$rc_annual', kind: 'yearly' as const, label: 'Yearly', period: 'year' },
  { id: PRODUCT_IDS.monthly, pkg: '$rc_monthly', kind: 'monthly' as const, label: 'Monthly', period: 'month' },
  { id: PRODUCT_IDS.weekly, pkg: '$rc_weekly', kind: 'weekly' as const, label: 'Weekly', period: 'week' },
  { id: PRODUCT_IDS.lifetime, pkg: '$rc_lifetime', kind: 'lifetime' as const, label: 'Lifetime', period: null },
];

export const ALL_PRODUCT_IDS = PRODUCT_CATALOG.map((p) => p.id);

export const isKnownProduct = (id: string) => ALL_PRODUCT_IDS.some((p) => id === p || id.startsWith(p + ':'));

export const PRIVACY_URL = 'https://samayhuf-star.github.io/app-legal/chezz/privacy.html';
export const TERMS_URL = 'https://samayhuf-star.github.io/app-legal/chezz/terms.html';
export const SUPPORT_URL = 'https://samayhuf-star.github.io/app-legal/chezz/support.html';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
