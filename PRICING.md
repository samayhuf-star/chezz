# Pricing (decision of 17 Nov 2026)

One plan for the app: **weekly subscription, $1.99 per week, 7-day free trial** (new subscribers).
Applies to every app except Klenzer. Monthly, yearly and lifetime plans are retired from the paywall.

## Store and RevenueCat setup to match
- App Store Connect: auto-renewing subscription `chezz_pro_weekly`, duration 1 week, price $1.99 (US tier), introductory offer = free trial, 1 week, all territories.
- Google Play (where the app ships there): matching base plan, weekly, $1.99, free-trial offer of 7 days. The app is a free download with the subscription inside it (Play does not allow a trial on an upfront-paid app).
- RevenueCat: entitlement `pro` attached to the weekly product; `default` offering has one WEEKLY package; paywall copy reads "7 days free, then $1.99/week".
- Remove old monthly / yearly / lifetime packages from the offering. Do not delete the old products if anyone already bought them; they stay recognised.

The paywall code reads the weekly product from the store, so it shows "unavailable" until this product exists. Merge this branch only after the product is created.
