# Google Play — Data Safety Form Answers

Working reference for filling out the Data Safety section in Play Console for **Sahid Freight** (`com.sahidfreight.app`). Pre-answered against the actual data the app collects, in lock-step with the public privacy policy at https://sahidfreight.com/privacy-policy.

**Effective:** 2026-06-22

---

## Top-level posture

| Question (Play Console) | Our answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (TLS for every request between the app and our API; document/photo storage encrypted at rest) |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app account deletion + email request to `info@sahidfreight.com` |
| Has your data collection and security practices been independently validated? | **No** (independent audit not yet completed) |

### High-scrutiny items to flag in advance

These items typically draw additional Play review and may require **prominent in-app disclosure**:

1. **Precise location** (GPS) — drivers only, in-transit only. Foreground sampling; declared `ACCESS_BACKGROUND_LOCATION` in `app.json` should be reviewed (see notes at end). Be ready to attach a prominent-disclosure screenshot if asked.
2. **Government ID and identity documents** — national ID, driver's licence, trade licence. These count under "Personal info → Other personal info" and require a clear purpose statement (we use them for KYC / fraud prevention, reviewed by our team).

### What we DO NOT collect (declare "Data not collected")

- **Device or other identifiers** — no advertising ID, no device ID, no IMEI, no Android ID
- **Web browsing history**
- **App activity** — no analytics, no in-app search history, no installed-app inventory
- **App info and performance** — no Crashlytics, no Sentry, no Firebase Performance Monitoring
- **Audio data**, **Videos**, **Music files**, **Calendar events**, **Contacts**, **Health and fitness**
- **Advertising data** of any kind — we do not run ads in the app

(No Sentry / Mixpanel / Firebase Analytics / Crashlytics imported anywhere in the codebase, confirmed by repo grep. `req.ip` is used by `express-rate-limit` for in-memory throttling only and is never logged or persisted.)

---

## Per-data-type answers

Use Google's exact category names below. For each entry, answer the four collection sub-questions (Collected, Shared, Processed ephemerally, Required/Optional, Purposes).

---

### 1. Personal info → Name

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required |
| **Purposes** | App functionality; Account management |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes (in-app + `info@sahidfreight.com`) |

Notes: Provided at registration. Shared with marketplace counterparties on bookings (user-to-user, not third-party — see note at bottom of this doc).

---

### 2. Personal info → Email address

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | **Yes — Resend** (transactional email provider; receives recipient email + email content for OTP delivery) |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required |
| **Purposes** | Account management; App functionality |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes |

Notes: Verified at registration via 6-digit email OTP. The email field is unique per account.

---

### 3. Personal info → Phone number

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | **Yes — Chapa and Waafi** (payment gateways; receive the user's phone as the contact field when a payment is initiated) |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required |
| **Purposes** | App functionality; Account management |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes |

Notes: Phone is the user's sign-in identifier and is shown to marketplace counterparties on bookings so parties can call each other to coordinate pickup/delivery (user-to-user — see note at bottom).

---

### 4. Personal info → User IDs

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required |
| **Purposes** | App functionality; Account management |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes |

Notes: Our internal user UUID, role (Cargo Sender / Truck Owner / Driver), and city/country preference. Not an external/advertising identifier.

---

### 5. Personal info → Other info (Identity documents — HIGH SCRUTINY)

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No (reviewed by our internal team only) |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required (for verified status; users can sign up unverified) |
| **Purposes** | Fraud prevention, security, and compliance; Account management |
| **Encrypted in transit** | Yes (TLS); encrypted at rest in object storage |
| **Users can request deletion** | Yes — deleted on account deletion unless we are legally required to retain |

Notes: National ID, driver's licence, trade licence, profile photo. Upload-on-demand from the in-app verification flow. **Flag for review:** Google may request additional purpose justification.

---

### 6. Financial info → User payment info

| Field | Answer |
|---|---|
| **Collected** | **No** |

Notes: **The app never collects, transmits, or stores card numbers, bank account details, or any other payment credentials.** Payments are processed by third-party gateways (Chapa, Waafi) on their own web checkout — we hand off the user to the gateway and receive only the transaction status and a reference identifier in return. The transaction *amount* and the user's email/phone are sent to the gateway as contact info (already covered under Email and Phone above).

---

### 7. Financial info → Purchase history

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No |
| **Processed ephemerally only** | No |
| **Required or Optional** | Required (incidental to using the marketplace) |
| **Purposes** | App functionality |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes — subject to legal retention for tax/audit |

Notes: Booking and payment records (amount, status, provider reference, timestamp). No card data.

---

### 8. Location → Precise location (GPS) — HIGH SCRUTINY

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No (shared with the *other user* on the booking — see note at bottom) |
| **Processed ephemerally only** | No (location points are persisted as booking history) |
| **Required or Optional** | Required for drivers acting on an in-transit booking; not collected from other users |
| **Purposes** | App functionality (real-time shipment tracking) |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes |

Notes: Collected from the driver's device **only while a booking is in the "in-transit" state**, sampled at ~5-second intervals via `expo-location` `watchPositionAsync`. Stops when the booking is marked delivered, cancelled, or otherwise no longer in transit. Not collected from cargo senders. Stored in the `TruckLocation` table so participants can review where the shipment travelled.

**Prominent disclosure required:** Yes — when the driver enters the in-transit state, the app should display a clear notice that location is being shared with the cargo sender during this trip.

**Note on `ACCESS_BACKGROUND_LOCATION` permission:** Declared in `app.json` but actual background collection should be re-verified before submission. If we are foreground-only in practice, downgrade the manifest to `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION` only to avoid the stricter Play review path for background-location apps.

---

### 9. Location → Approximate location

| Field | Answer |
|---|---|
| **Collected** | No |

Notes: City/country are user-typed text fields at registration, not derived from the device's location services. Those are covered under "User IDs" / profile data.

---

### 10. Photos and videos → Photos

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No |
| **Processed ephemerally only** | No |
| **Required or Optional** | Optional (depending on flow — required for drivers to mark delivery; optional for owners adding truck photos) |
| **Purposes** | App functionality |
| **Encrypted in transit** | Yes (TLS); encrypted at rest in object storage |
| **Users can request deletion** | Yes |

Notes: Two flows — (a) **proof-of-delivery photos** uploaded by the driver to confirm a successful delivery, (b) **truck photos** uploaded by truck owners to identify their vehicles.

---

### 11. Photos and videos → Videos

| Field | Answer |
|---|---|
| **Collected** | No |

---

### 12. Audio files

| Field | Answer |
|---|---|
| **Collected** | No |

---

### 13. Files and docs

| Field | Answer |
|---|---|
| **Collected** | Yes (covered under "Personal info → Other info" — identity documents above) |

(If Play Console requires a separate Files & Docs declaration in addition to the Personal info one: same answers as item 5.)

---

### 14. Calendar / Contacts / Health and fitness / Audio data

| Field | Answer |
|---|---|
| **Collected** | No |

---

### 15. Messages → In-app messages

| Field | Answer |
|---|---|
| **Collected** | Yes |
| **Shared with third parties** | No |
| **Processed ephemerally only** | No |
| **Required or Optional** | Optional (use of the chat feature is optional) |
| **Purposes** | App functionality |
| **Encrypted in transit** | Yes (TLS) |
| **Users can request deletion** | Yes |

Notes: In-app chat messages between marketplace users, scoped to specific bookings. Message content, sender/recipient IDs, timestamp, and read status are stored on our servers so the conversation history is available to the participants.

---

### 16. Messages → Emails, SMS

| Field | Answer |
|---|---|
| **Collected** | No |

Notes: We do not access the user's email inbox, contacts list, or SMS messages on the device. The OTP we send via Resend is initiated by us; we don't read messages on the device.

---

### 17. Web browsing → Web browsing history

| Field | Answer |
|---|---|
| **Collected** | No |

---

### 18. App activity

| Field | Answer |
|---|---|
| **Collected** | No |

Notes: No analytics, no in-app search history collection, no installed-app inventory, no other-app interaction.

---

### 19. App info and performance

| Field | Answer |
|---|---|
| **Collected** | No |

Notes: No crash logs, no diagnostic data, no performance metrics. Confirmed by repo grep: no Sentry, no Crashlytics, no Firebase Performance Monitoring, no third-party crash reporters installed.

---

### 20. Device or other identifiers

| Field | Answer |
|---|---|
| **Collected** | No |

Notes: No advertising ID, no device ID, no IMEI, no Android ID, no MAC address, no `expo-device` identifiers (commented out in `apps/mobile/src/lib/notifications.ts`). The `User.pushToken` field exists in schema but push delivery is currently disabled. If push is enabled before submission, this will need to be added under "Device or other identifiers" with purpose **App functionality**, shared with **Expo Push Service** (a third-party push delivery service).

---

### 21. Health and fitness / Financial info (besides above) / Authentication data (besides Password)

| Field | Answer |
|---|---|
| **Collected** | No |

---

## Note on user-to-user sharing inside the app

Google's "Shared with third parties" question is about sharing with **other companies/organizations** outside your own. It is **not** the same thing as visibility between users of your app.

Several pieces of personal data are intentionally visible to other users of the Sahid Freight marketplace, as part of the service:
- A booking's counterparties (sender, owner, driver) see each other's **name** and **phone number** so they can coordinate.
- A cargo sender sees the **live GPS location** of the driver's truck while the booking is in transit.
- Truck owners see their own **drivers** in their fleet list.

This is **user-to-user data sharing within the app's primary functionality**, not third-party sharing for Data Safety purposes. We declare it in the privacy policy under "How We Share Your Information → With other users you transact with," and on the Data Safety form we answer "Shared = No" for those data types' third-party-sharing question. (Resend, Chapa, and Waafi are the only true third parties we share with.)

If asked by Google during review to clarify, point at the privacy policy section that explains the user-to-user sharing in plain terms.
