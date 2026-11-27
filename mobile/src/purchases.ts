// Chezz Pro billing via RevenueCat (react-native-purchases). Offering "default", entitlement "pro".
// Startup only configures the SDK and reads cached customer info: never restores (no Apple ID prompt).
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { ENTITLEMENT_ID, PRODUCT_CATALOG } from './config';

export type Plan = (typeof PRODUCT_CATALOG)[number] & { price: string; trial: string | null; pkg: string; rcPackage: PurchasesPackage };
export type BuyResult = 'purchased' | 'cancelled' | 'pending' | 'error';
export type PlansLoad = { plans: Plan[]; error: string | null };

const KEY = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;
const UNAVAILABLE = 'Plans unavailable right now. Please try again shortly.';
let configured = false;
const entitlementListeners = new Set<(isPro: boolean) => void>();

const logErr = (action: string, e: unknown) => {
  const err = e as { code?: unknown; message?: string };
  console.log('[chezz-rc]', `${action} failed`, { code: err?.code, message: err?.message });
};

export const isPro = (info: CustomerInfo | null | undefined) => !!info?.entitlements.active[ENTITLEMENT_ID];
const emitPro = (value: boolean) => entitlementListeners.forEach((cb) => cb(value));

export function initIAP(): boolean {
  if (configured) return true;
  if (!KEY) return false;
  try {
    Purchases.configure({ apiKey: KEY });
    Purchases.addCustomerInfoUpdateListener((info) => emitPro(isPro(info)));
    configured = true;
  } catch (e) {
    logErr('configure', e);
  }
  return configured;
}

const trialText = (p: PurchasesPackage): string | null => {
  const intro = p.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit.toLowerCase();
  return `${intro.periodNumberOfUnits}-${unit} free trial`;
};

export async function loadPlans(): Promise<PlansLoad> {
  if (!initIAP()) return { plans: [], error: UNAVAILABLE };
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    const plans: Plan[] = [];
    for (const def of PRODUCT_CATALOG) {
      const p = pkgs.find((x) => x.identifier === def.pkg);
      if (p) plans.push({ ...def, price: p.product.priceString, trial: trialText(p), rcPackage: p });
    }
    return plans.length ? { plans, error: null } : { plans: [], error: UNAVAILABLE };
  } catch (e) {
    logErr('getOfferings', e);
    return { plans: [], error: UNAVAILABLE };
  }
}

export async function refreshEntitlements(): Promise<boolean> {
  if (!initIAP()) return false;
  try {
    return isPro(await Purchases.getCustomerInfo());
  } catch (e) {
    logErr('getCustomerInfo', e);
    return false;
  }
}

export function onEntitlementChange(cb: (isPro: boolean) => void): () => void {
  entitlementListeners.add(cb);
  return () => {
    entitlementListeners.delete(cb);
  };
}

export async function buyPlan(plan: Plan): Promise<BuyResult> {
  if (!initIAP()) return 'error';
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.rcPackage);
    const ok = isPro(customerInfo);
    emitPro(ok);
    return ok ? 'purchased' : 'error';
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string };
    if (err?.userCancelled || err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return 'cancelled';
    if (err?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return 'pending';
    logErr('purchasePackage', e);
    return 'error';
  }
}

/** User-initiated only (Restore button). */
export async function restore(): Promise<boolean> {
  if (!initIAP()) return false;
  const ok = isPro(await Purchases.restorePurchases());
  emitPro(ok);
  return ok;
}

/** Hook used by the app UI. Init and entitlement refresh run in the background and never block the splash. */
export function usePro() {
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    const un = onEntitlementChange((value) => {
      if (!dead) setPro(value);
    });
    (async () => {
      const value = await refreshEntitlements();
      if (dead) return;
      setPro(value);
      setLoading(false);
    })();
    return () => {
      dead = true;
      un();
    };
  }, []);

  const buy = useCallback(async (plan: Plan) => {
    const result = await buyPlan(plan);
    if (result === 'purchased') return { ok: true };
    if (result === 'cancelled') return { ok: false };
    if (result === 'pending') return { ok: false, error: 'This purchase is waiting for approval.' };
    return { ok: false, error: 'Purchase failed' };
  }, []);

  const doRestore = useCallback(async () => {
    try {
      const ok = await restore();
      return ok ? { ok: true } : { ok: false, error: 'No active Chezz Pro purchase found.' };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Restore failed' };
    }
  }, []);

  return { pro, loading, buy, restore: doRestore };
}
