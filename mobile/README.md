# Chezz — mobile app

Expo (React Native) iOS and Android app by Samay Vashsht. Play chess against 50 bot levels. Levels 1–10 are free. Chezz Pro unlocks levels 11–50 and unlimited hints through the App Store or Google Play.

## Billing

Chezz Pro is an auto-renewing yearly (`chezz_pro_yearly`) or monthly (`chezz_pro_monthly`) subscription via StoreKit 2 / Google Play Billing (`expo-iap`). Prices come from the store and are not hard-coded. The app does not use RevenueCat. Launch does not call sync or restore; the splash does not wait on purchases.

## Legal

Copyright © 2026 Samay Vashsht.

- Privacy: https://samayhuf-star.github.io/app-legal/chezz/privacy.html
- Terms: https://samayhuf-star.github.io/app-legal/chezz/terms.html
- Support: https://samayhuf-star.github.io/app-legal/chezz/support.html

Contact: samayhuf@gmail.com only. Postal address: 2/61 Bhim Street, Vishwas Nagar, Delhi 110032, India. Governing law: Delhi, India.

## Develop

```bash
npm install
npx expo start
npm run typecheck
npm run lint
npm test
```

iOS production builds use EAS on the krosz Expo account. Bundle ID: `com.samayvashsht.chezz`. The production API URL is `https://chezz.samayhuf.workers.dev`.
