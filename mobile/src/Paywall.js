import { useEffect } from 'react';
import { Alert } from 'react-native';
import { initPurchases, storeReady } from './purchases';
import { presentPaywall } from './revenuecat';

// Chezz Pro uses RevenueCat's own paywall: design, prices, trial and plans are edited in the
// RevenueCat dashboard (offering "default") and update without an app release.
export default function Paywall({ visible, onClose, reason }) {
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    (async () => {
      if (!storeReady() || !(await initPurchases())) {
        Alert.alert('Chezz Pro', 'Purchases are not set up in this build yet.');
        if (alive) onClose(false);
        return;
      }
      const ok = await presentPaywall(reason ? 'locked_feature' : 'upsell_banner');
      if (alive) onClose(ok);
    })();
    return () => { alive = false; };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
