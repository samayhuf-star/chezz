// Pure helpers for the Chezz Pro paywall. Prices always come from the store
// product (priceString). A package with no price or no period is omitted so
// the paywall never offers a plan it cannot describe.

const UNIT = { D: 'day', W: 'week', M: 'month', Y: 'year' };
const BY_TYPE = {
  ANNUAL: '1 year',
  MONTHLY: '1 month',
  SIX_MONTH: '6 months',
  THREE_MONTH: '3 months',
  TWO_MONTH: '2 months',
  WEEKLY: '1 week',
};

export function lengthFromPeriod(iso) {
  const m = /^P(\d+)([DWMY])$/.exec(String(iso || ''));
  if (!m) return '';
  const n = Number(m[1]);
  return n + ' ' + UNIT[m[2]] + (n === 1 ? '' : 's');
}

// Free-trial length in days from the store's introductory offer, or 0 when there is none.
export function trialDays(product) {
  const i = product && product.introPrice;
  if (!i || Number(i.price) > 0) return 0;
  const n = Number(i.periodNumberOfUnits) || 0;
  const mult = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }[i.periodUnit] || 0;
  return n * mult;
}

export function describePlan(pkg, products) {
  const product = (pkg && pkg.product) || {};
  const id = product.identifier || '';
  const kind = product.productType;
  if (kind && kind !== 'AUTO_RENEWABLE_SUBSCRIPTION' && kind !== 'UNKNOWN') return null;
  let length = lengthFromPeriod(product.subscriptionPeriod);
  if (!length) length = BY_TYPE[pkg && pkg.packageType] || '';
  if (!length && products) {
    if (id === products.weekly) length = '1 week';
  }
  const price = product.priceString;
  if (!length || !price) return null;
  const title = length === '1 week' ? 'Chezz Pro Weekly' : length === '1 year' ? 'Chezz Pro Yearly' : length === '1 month' ? 'Chezz Pro Monthly' : 'Chezz Pro (' + length + ')';
  return { title, length, price, trial: trialDays(product), key: (pkg && pkg.identifier) || id };
}

export function sortPlans(plans) {
  const rank = p => (p.length === '1 week' ? 0 : p.length === '1 year' ? 1 : p.length === '1 month' ? 2 : 3);
  return plans.slice().sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
