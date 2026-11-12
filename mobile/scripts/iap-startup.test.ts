import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function src(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

function functionBody(source: string, name: string): string {
  const re = new RegExp(`(?:export )?(?:async )?function ${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{`);
  const m = re.exec(source);
  if (!m || m.index == null) throw new Error(`Could not find function ${name}`);
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
    i++;
  }
  return source.slice(start, i - 1);
}

function bootEffects(app: string): string {
  const marker = 'SplashScreen.hideAsync()';
  const at = app.indexOf(marker);
  if (at < 0) throw new Error('Could not find SplashScreen.hideAsync in App.js');
  // Capture from the splash-hide effect through the following boot effect.
  const start = app.lastIndexOf('useEffect', at);
  const end = app.indexOf('/* ---------- game ---------- */', at);
  if (start < 0 || end < 0) throw new Error('Could not bound boot effects');
  return app.slice(start, end);
}

const PROMPTING = [/syncIOS\s*\(/, /storeRestore\s*\(/, /restorePurchases\s*\(/, /getAvailablePurchases\s*\(/];

describe('IAP startup must not prompt for Apple ID', () => {
  const purchases = src('src/purchases.ts');
  const app = src('App.js');
  const config = src('src/config.ts');
  const paywall = src('src/Paywall.js');

  it('initIAP only connects and listens — no sync, restore, or getAvailablePurchases', () => {
    const body = functionBody(purchases, 'initIAP');
    for (const re of PROMPTING) {
      assert.equal(re.test(body), false, `${re} must not run inside initIAP`);
    }
    assert.match(body, /ensureConnected|initConnection|attachListeners/);
  });

  it('refreshEntitlements uses current entitlements only — no sync or restore', () => {
    const body = functionBody(purchases, 'refreshEntitlements');
    for (const re of PROMPTING) {
      assert.equal(re.test(body), false, `${re} must not run inside refreshEntitlements`);
    }
    assert.match(body, /currentEntitlementIOS|hasActiveSubscriptions|getActiveSubscriptions/);
  });

  it('sync and restore run only from restore(), when the user taps Restore Purchases', () => {
    const body = functionBody(purchases, 'restore');
    assert.match(body, /syncIOS\s*\(/);
    assert.match(body, /storeRestore\s*\(/);
  });

  it('App boot hides the splash before any IAP work and never calls sync or restore', () => {
    const boot = bootEffects(app);
    assert.match(boot, /SplashScreen\.hideAsync/);
    assert.doesNotMatch(boot, /syncIOS\s*\(/);
    assert.doesNotMatch(boot, /restorePurchases\s*\(/);
    assert.doesNotMatch(boot, /getAvailablePurchases\s*\(/);
    assert.doesNotMatch(boot, /initIAP\s*\(|refreshEntitlements\s*\(|loadPlans\s*\(/);
    const hideAt = app.indexOf('SplashScreen.hideAsync');
    const hookAt = app.indexOf('const billing = usePro()');
    assert.ok(hideAt >= 0 && hookAt >= 0);
    // usePro is called during render, but its IAP work is in an effect; splash hide is also an effect and must not await IAP.
    assert.doesNotMatch(boot, /await initIAP|await refreshEntitlements|await loadPlans/);
  });

  it('usePro starts IAP in a background effect and does not prompt', () => {
    const body = functionBody(purchases, 'usePro');
    for (const re of PROMPTING) {
      assert.equal(re.test(body), false, `${re} must not run inside usePro`);
    }
    assert.match(body, /initIAP\s*\(/);
    assert.match(body, /refreshEntitlements\s*\(/);
  });

  it('the purchase-update listener path does not call getAvailablePurchases, sync, or restore', () => {
    for (const name of ['verifyOnDevice', 'verifyAndFinish', 'attachListeners'] as const) {
      const body = functionBody(purchases, name);
      for (const re of PROMPTING) {
        assert.equal(re.test(body), false, `${re} must not run inside ${name}`);
      }
    }
    const restore = functionBody(purchases, 'restore');
    const allCalls = purchases.match(/getAvailablePurchases\s*\(/g) ?? [];
    const restoreCalls = restore.match(/getAvailablePurchases\s*\(/g) ?? [];
    assert.equal(allCalls.length, restoreCalls.length);
    assert.ok(restoreCalls.length >= 1);
  });

  it('uses the App Store Connect product IDs and does not hard-code a price', () => {
    assert.match(config, /chezz_pro_yearly/);
    assert.match(config, /chezz_pro_monthly/);
    assert.doesNotMatch(config, /RevenueCat|RC_IOS_KEY|RC_ANDROID_KEY|\$3\.99|\$24\.99/);
    assert.doesNotMatch(app, /react-native-purchases|RevenueCat|\$3\.99/);
    assert.doesNotMatch(paywall, /react-native-purchases|offering|priceString|\$3\.99/);
    assert.match(paywall, /p\.price/);
  });
});
