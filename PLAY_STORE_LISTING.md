# Google Play — Store Listing

Paste-from reference for filling out the Store Listing section in Play Console for **Sahid Freight** (`com.sahidfreight.app`). Pre-filled with the exact copy and metadata to use, in lock-step with the privacy policy at https://sahidfreight.com/privacy-policy and the data-safety reference at [PLAY_DATA_SAFETY.md](./PLAY_DATA_SAFETY.md).

**Effective:** 2026-06-22

---

## Quick-fill table

| Field | Limit | Value | Length |
|---|---|---|---|
| **App name (title)** | 30 chars | `Sahid Freight` | 13 |
| **Short description** | 80 chars | `Post cargo, book trucks, track shipments — across the Horn of Africa.` | 70 |
| **Full description** | 4000 chars | *(see full block below)* | ~1620 |
| **App category (primary)** | — | `Business` | — |
| **Contact email** | — | `info@sahidfreight.com` | — |
| **Website** | — | `https://sahidfreight.com` | — |
| **Privacy policy URL** | — | `https://sahidfreight.com/privacy-policy` | — |

---

## App title

```
Sahid Freight
```

(13 / 30 characters)

---

## Short description

```
Post cargo, book trucks, track shipments — across the Horn of Africa.
```

(70 / 80 characters)

---

## Full description

```
Sahid Freight connects cargo senders with truck owners and drivers across Ethiopia, Somalia, and Djibouti. Whether you have goods to move or trucks ready to earn, Sahid Freight makes freight simple, transparent, and reliable.

FOR CARGO SENDERS
- Post your load in minutes — pickup, destination, weight, and schedule
- Receive bids from verified truck owners and choose the offer that works for you
- Track your shipment in real time while it's on the road
- Coordinate directly with your driver through in-app messaging
- Confirm delivery with proof-of-delivery photos

FOR TRUCK OWNERS
- Browse available loads in your region
- Place competitive bids and grow your business
- Manage your fleet and assign trusted drivers
- Get paid through secure local payment options

FOR DRIVERS
- See your assigned deliveries at a glance
- Navigate pickups and drop-offs with confidence
- Update delivery status and upload proof of delivery
- Stay connected with senders and owners throughout the trip

WHY SAHID FREIGHT
- Built for the Horn of Africa — Ethiopia, Somalia, and Djibouti
- Verified users — we review identity and licensing for trust and safety
- Real-time tracking — know where your cargo is, every step of the way
- Secure payments through trusted local gateways
- Simple, clear pricing with no hidden surprises

Sahid Freight is named in honor of a grandfather whose legacy of hard work and connection inspires everything we build. Join a growing community making freight across the region faster, fairer, and more transparent.

Download Sahid Freight today and move your cargo with confidence.
```

(~1620 / 4000 characters)

---

## Category & taxonomy

| Field | Value | Notes |
|---|---|---|
| **Primary category** | Business | Best fit for a B2B logistics marketplace. Avoids "Maps & Navigation," which can trigger extra location-data scrutiny we don't need. |
| **Tags** | Freight, Logistics, Trucking, Cargo, Shipping | Optional but useful for discovery. |
| **Target audience** | 18+ | The app is not intended for children. Matches the privacy policy "Children" section. |

---

## Contact & links

| Field | Value |
|---|---|
| **Developer email** | `info@sahidfreight.com` |
| **Website** | `https://sahidfreight.com` |
| **Privacy policy URL** | `https://sahidfreight.com/privacy-policy` |
| **Phone (optional)** | `+251 911 000 000` *(matches the website footer)* |

---

## Still needed (not copy — assets)

These cannot be pasted; they must be created/captured and uploaded separately in Play Console.

| Asset | Spec | Status | Notes |
|---|---|---|---|
| **App icon (Play Store)** | 512×512 PNG, 32-bit, no alpha | ❌ Needs export | We have the 1024×1024 source at `apps/mobile/assets/icon.png` — resize to 512×512 and flatten the alpha channel. |
| **Feature graphic** | 1024×500 PNG (no alpha) | ❌ Missing entirely | Headers the store listing. Should match the brand: navy `#0A1F44`, blue accent `#3D7BFF`, logo + a tagline. |
| **Phone screenshots** | 2–8 PNGs, 16:9 or 9:16; min 320 px, max 3840 px on the long edge; recommended 1080×1920 | ❌ Missing | Capture from a real preview build. Suggested screens: login, post-a-load, available-loads list, booking detail with bid panel, live tracking map, driver active-trip screen, proof-of-delivery upload, profile. |
| **Tablet screenshots (7"/10")** | Optional | ❌ Skip for v1 | Not required. Skip unless we ship a tablet-optimized layout. |
| **Promo video (YouTube link)** | Optional | ❌ Skip for v1 | Nice-to-have, not blocking. |
| **Content rating questionnaire** | Filled in Console | ❌ Pending | Answer truthfully: no gambling, no user-generated content shared publicly (chat is private 1:1), no ads, no purchases of digital goods. Expected outcome: **Everyone** or **Teen**. |
| **Data Safety form** | Filled in Console | 📄 Pre-answered | See [PLAY_DATA_SAFETY.md](./PLAY_DATA_SAFETY.md). |
| **App access** | Specify if testing requires login | ⚠️ Action needed | Provide a test account credentials to Google so reviewers can log in. Use the truck-owner test account from project memory or create a dedicated `playstore-review@sahidfreight.com`. |

---

## Pre-submission checklist

Before hitting "Submit for review" in Play Console, confirm:

- [ ] **AAB built** — `eas.json` production profile updated with `"android": { "buildType": "aab" }` (currently missing — Stage 6 blocker)
- [ ] **Firebase plugins stripped** from `app.json` (still declared even though JS is Firebase-free; Stage 6 cleanup)
- [ ] **`ACCESS_BACKGROUND_LOCATION` permission verified or removed** — if we're foreground-only in practice, drop the background permission from the manifest to avoid the stricter Play review path
- [ ] **Prominent-disclosure screen** added to driver flow if background location is kept
- [ ] **Privacy policy reachable** at `https://sahidfreight.com/privacy-policy` (verify after Vercel deploy)
- [ ] **Test account credentials** prepared for reviewer access
- [ ] **Feature graphic** designed and exported (1024×500 PNG)
- [ ] **Phone screenshots** captured (≥ 2)
- [ ] **App icon** exported at 512×512 PNG, no alpha
- [ ] **Content rating questionnaire** completed in Console
- [ ] **Data Safety form** completed in Console (paste from [PLAY_DATA_SAFETY.md](./PLAY_DATA_SAFETY.md))
