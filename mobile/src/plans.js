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

export function describePlan(pkg, products) {
  const product = (pkg && pkg.product) || {};
  const id = product.identifier || '';
  const kind = product.productType;
  if (kind && kind !== 'AUTO_RENEWABLE_SUBSCRIPTION' && kind !== 'UNKNOWN') return null;
  let length = lengthFromPeriod(product.subscriptionPeriod);
  if (!length) length = BY_TYPE[pkg && pkg.packageType] || '';
  if (!length && products) {
    if (id === products.yearly) length = '1 year';
    else if (id === products.monthly) length = '1 month';
  }
  const price = product.priceString;
  if (!length || !price) return null;
  const title = length === '1 year' ? 'Chezz Pro Yearly' : length === '1 month' ? 'Chezz Pro Monthly' : 'Chezz Pro (' + length + ')';
  return { title, length, price, key: (pkg && pkg.identifier) || id };
}

export function sortPlans(plans) {
  const rank = p => (p.length === '1 year' ? 0 : p.length === '1 month' ? 1 : 2);
  return plans.slice().sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
}
