# Chezz, ClearScan, CoreForge — App Store Connect prep

- Date: 12 Nov 2026, 5:21 PM Asia/Dhaka
- Scope: prep only. No builds, no submissions, no other apps touched.
- Team: PGLT2QZX88, via the ASC API (no browser, no login).
- Copyright set where a record already existed: `2026 Samay Vashsht`

## Chezz

- Expo config: `samayhuf-star/chezz` `mobile/app.json` — name **Chezz**, bundle ID `com.samayvashsht.chezz`.
- Bundle ID: **already existed** — identifier `com.samayvashsht.chezz`, ASC bundle ID `3G6S7RHSJA`, name Chezz, platform UNIVERSAL, seed ID PGLT2QZX88. Nothing created.
- App record: **already existed** — ASC app id `6833211552`, listing name "Chezz: Chess vs 50 Bots", SKU `chezz-ios-001`.
- Copyright: set on editable iOS 1.0 (`PREPARE_FOR_SUBMISSION`, version id `71fa849d-9a9b-4eb5-88e7-860c6968bf5c`). Was empty; now `2026 Samay Vashsht`. Confirmed with a follow-up GET.
- API refusals: none. POST `/v1/apps` was not tried because the app record already exists.

## ClearScan

- Expo config: `samayhuf-star/Clear-Scan` `app.json` — name **ClearScan**, bundle ID `com.samayhuf.clearscan` (matches the brief).
- Bundle ID: **already existed** — identifier `com.samayhuf.clearscan`, ASC bundle ID `2N5U8MZFT5`, name ClearScan, platform UNIVERSAL, seed ID PGLT2QZX88. Nothing created.
- App record: **already existed** — ASC app id `6833164518`, listing name "ClearScan: Private PDF Scanner", SKU `clearscan-ios-001`.
- Copyright: set on editable iOS 1.0 (`PREPARE_FOR_SUBMISSION`, version id `40d9a518-40d8-4418-9622-54b6e7904e77`). Was empty; now `2026 Samay Vashsht`. Confirmed with a follow-up GET.
- API refusals: none. POST `/v1/apps` was not tried because the app record already exists.

## CoreForge

- Repo `samayhuf-star/coreforge` (`main` only) has `package.json`, `eas.json` and `App.js`, but **no `app.json` or `app.config.js` / `app.config.ts`**, and no `bundleIdentifier` anywhere in the tree. README / `STORE_LISTING.md` name the app **CoreForge**, but that is not an Expo app config, so no bundle ID was taken from it and none was invented.
- Bundle ID: **missing**. Exact-match lookups for `com.samayhuf.coreforge`, `com.samayvashsht.coreforge` and `com.krosz.coreforge` returned nothing. A full list of the team's 16 bundle IDs and 9 app records also has no CoreForge name or identifier. Nothing was created.
- App record: **missing**. No ASC app id.
- Copyright: not set (no app record, so no editable `appStoreVersion`).
- API refusals: POST `/v1/apps` was not attempted. Chezz and ClearScan already have records, and CoreForge has no known bundle ID to attach. The public ASC API is not expected to allow creating apps; once an Expo config exists and the bundle ID is registered, Samay or COO will need to create the app record in the App Store Connect web UI, or `eas submit` interactive can do it later.

## Not done (by design)

- No builds, no TestFlight uploads, no review submissions.
- No guessed CoreForge bundle ID.
- No browser and no Apple ID login.
