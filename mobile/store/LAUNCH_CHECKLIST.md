# Chezz Launch Checklist

## Already done
- [x] Privacy policy, terms, support pages
- [x] Store listing copy (`APP_STORE_LISTING.md`)
- [x] Mobile Expo project with icons
- [x] RevenueCat structure (entitlement `pro`)
- [x] Cloudflare / API backend design

## Still needed before submit
- [ ] Deploy with `npm run deploy` (needs a Cloudflare login and `CHESS_SECRET`; see README). The Worker at `https://chezz.samayhuf.workers.dev` is already serving; re-run the script to apply `schema.sql` and the current code.
- [ ] EAS production environment variables (public SDK keys, not the RevenueCat secret key): `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`. `EXPO_PUBLIC_API_URL` is already in `eas.json`.
- [ ] App Store Connect app `com.samayvashsht.chezz` (id `6833211552`) still needs a build, screenshots, description, support URL, and privacy URL
- [ ] Finish metadata for the existing subscription group "Chezz Pro":
  - `chezz_pro_monthly` — 1 month — US $3.99
  - `chezz_pro_yearly` — 1 year — US $24.99
- [ ] Sign the Paid Apps agreement. StoreKit will not return prices until it is signed.
- [ ] RevenueCat: attach both products to entitlement `pro` and to the current offering as the monthly and annual packages
- [ ] Generate 5 screenshots from real UI (see `assets-prompts.md`)
- [ ] EAS production build + TestFlight
- [ ] Privacy nutrition label answers (data linked: User ID, display name/location)
- [ ] Age rating 4+

## Notes
- Free: levels 1–10
- Pro: levels 11–50 + unlimited hints
- No ads, no tracking
