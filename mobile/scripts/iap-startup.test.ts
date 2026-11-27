import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(root, rel), 'utf8');

function fnBody(source: string, name: string): string {
  const m = new RegExp(`(?:export )?(?:async )?function ${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{`).exec(source);
  if (!m) throw new Error(`no function ${name}`);
  let i = m.index + m[0].length, depth = 1;
  const start = i;
  while (i < source.length && depth > 0) { if (source[i] === '{') depth++; else if (source[i] === '}') depth--; i++; }
  return source.slice(start, i - 1);
}

describe('RevenueCat billing', () => {
  const p = src('src/purchases.ts');
  const cfg = src('src/config.ts');

  it('does not use expo-iap any more', () => {
    assert.ok(!/expo-iap/.test(p));
    assert.ok(!/expo-iap/.test(src('package.json')));
    assert.ok(!/"expo-iap"/.test(src('app.json')));
  });

  it('offers the four standard plans', () => {
    for (const pkg of ['$rc_weekly', '$rc_monthly', '$rc_annual', '$rc_lifetime']) assert.ok(cfg.includes(`'${pkg}'`), pkg);
    assert.ok(cfg.includes("ENTITLEMENT_ID = 'pro'"));
  });

  it('never restores during startup (no Apple ID prompt)', () => {
    for (const name of ['initIAP', 'refreshEntitlements', 'loadPlans', 'usePro']) {
      const body = name === 'usePro' ? fnBody(p, name).split('const doRestore')[0] : fnBody(p, name);
      assert.ok(!/restorePurchases|syncPurchases/.test(body), name);
    }
  });

  it('reads the RevenueCat key from env, not source', () => {
    assert.ok(!/appl_[A-Za-z0-9]{10,}/.test(p));
    assert.ok(/EXPO_PUBLIC_RC_IOS_KEY/.test(p));
  });
});

describe('onboarding + push', () => {
  it('has 9-10 onboarding screens', () => {
    const n = Number(/ONBOARDING_SCREENS = (\d+)/.exec(src('src/Onboarding.js'))?.[1]);
    assert.ok(n >= 9 && n <= 10);
  });
  it('requires consent before OneSignal collects data', () => {
    const push = src('src/push.ts');
    assert.ok(push.indexOf('setConsentRequired(true)') < push.indexOf('OneSignal.initialize'));
  });
});
