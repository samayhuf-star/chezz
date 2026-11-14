# Chezz Launch Checklist

## Already done
- [x] Privacy policy, terms, support pages
- [x] Store listing copy (`APP_STORE_LISTING.md`)
- [x] Mobile Expo project with icons
- [x] RevenueCat structure (entitlement `pro`)
- [x] Cloudflare / API backend design

## Still needed before submit
- [ ] Deploy Cloudflare Worker + set `CHESS_SECRET`
- [ ] Set `EXPO_PUBLIC_API_URL` in EAS for production
- [ ] Create App Store Connect app (`com.samayvashsht.chezz`)
- [ ] Create subscription group + products:
  - `chezz_pro_monthly` ($3.99)
  - `chezz_pro_yearly` ($24.99)
- [ ] RevenueCat: attach products to `pro` entitlement + default offering
- [ ] Generate 5 screenshots from real UI (see `assets-prompts.md`)
- [ ] EAS production build + TestFlight
- [ ] Privacy nutrition label answers (data linked: User ID, display name/location)
- [ ] Age rating 4+

## Notes
- Free: levels 1–10
- Pro: levels 11–50 + unlimited hints
- No ads, no tracking
