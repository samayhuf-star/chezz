// Browser build: there are no in-app purchases on the web, so Chesz Pro can only be bought in the mobile apps.
export const storeReady = () => false;
export async function initPurchases() { return false; }
const none = async () => ({ ok: false, error: 'Chesz Pro is sold in the iOS and Android apps.' });
export function usePro() { return { pro: false, offering: null, loading: false, buy: none, restore: none }; }
