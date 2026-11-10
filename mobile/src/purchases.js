import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { RC_IOS_KEY, RC_ANDROID_KEY, ENTITLEMENT } from './config';

const KEY = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
let configured = false;
export const storeReady = () => !!KEY;

export async function initPurchases() {
  if (configured || !KEY) return false;
  try { Purchases.configure({ apiKey: KEY }); configured = true; } catch (e) { return false; }
  return true;
}
const isPro = info => !!(info && info.entitlements && info.entitlements.active && info.entitlements.active[ENTITLEMENT]);

export function usePro() {
  const [pro, setPro] = useState(false), [offering, setOffering] = useState(null), [loading, setLoading] = useState(true);
  useEffect(() => {
    let sub = null, dead = false;
    (async () => {
      if (!(await initPurchases())) { setLoading(false); return; }
      try { const info = await Purchases.getCustomerInfo(); if (!dead) setPro(isPro(info)); } catch (e) {}
      try { const o = await Purchases.getOfferings(); if (!dead) setOffering(o.current || null); } catch (e) {}
      if (!dead) setLoading(false);
      Purchases.addCustomerInfoUpdateListener(info => setPro(isPro(info)));
    })();
    return () => { dead = true; };
  }, []);
  const buy = useCallback(async pkg => {
    try { const r = await Purchases.purchasePackage(pkg); const p = isPro(r.customerInfo); setPro(p); return { ok: p }; }
    catch (e) { return { ok: false, cancelled: !!e.userCancelled, error: e.userCancelled ? null : (e.message || 'Purchase failed') }; }
  }, []);
  const restore = useCallback(async () => {
    try { const info = await Purchases.restorePurchases(); const p = isPro(info); setPro(p); return { ok: p }; }
    catch (e) { return { ok: false, error: e.message || 'Restore failed' }; }
  }, []);
  return { pro, offering, loading, buy, restore };
}
