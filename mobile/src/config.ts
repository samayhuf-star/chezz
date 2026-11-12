// Public configuration. EXPO_PUBLIC_API_URL is set in eas.json for production builds.
const apiFromEnv: string = ((globalThis as { process?: { env?: { EXPO_PUBLIC_API_URL?: string } } }).process?.env?.EXPO_PUBLIC_API_URL) || '';
export const API_URL = apiFromEnv.replace(/\/$/, '');
export const FREE_LEVELS = 10; // levels 1..10 are free, 11..50 need Chezz Pro

export const PRODUCT_IDS = {
  yearly: 'chezz_pro_yearly',
  monthly: 'chezz_pro_monthly',
} as const;

export const PRODUCT_CATALOG = [
  { id: PRODUCT_IDS.yearly, kind: 'yearly' as const, type: 'subs' as const, label: 'Yearly', period: 'year' },
  { id: PRODUCT_IDS.monthly, kind: 'monthly' as const, type: 'subs' as const, label: 'Monthly', period: 'month' },
];

export const ALL_PRODUCT_IDS = PRODUCT_CATALOG.map((p) => p.id);

export const isKnownProduct = (id: string) => ALL_PRODUCT_IDS.includes(id as (typeof ALL_PRODUCT_IDS)[number]);

export const PRIVACY_URL = 'https://samayhuf-star.github.io/app-legal/chezz/privacy.html';
export const TERMS_URL = 'https://samayhuf-star.github.io/app-legal/chezz/terms.html';
export const SUPPORT_URL = 'https://samayhuf-star.github.io/app-legal/chezz/support.html';
export const SUPPORT_EMAIL = 'samayhuf@gmail.com';
