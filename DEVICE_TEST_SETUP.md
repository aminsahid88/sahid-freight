# Device Test Setup — Broker Pivot End-to-End

Copy-paste sequence against **prod** (`https://sahid-freight-production.up.railway.app`) that creates the full cast for the broker → driver → tracking → earnings round-trip.

Run top-to-bottom in one terminal. Wherever you see **⬅ PASTE**, copy the value from the previous response (or your email inbox) into the variable on that line, then continue.

---

## Prerequisites

- A real email inbox you control. The script uses Gmail-style `+aliases` (e.g. `you+broker@gmail.com`) so one inbox receives all three OTPs.
- The base email at the top must accept `+aliases` (Gmail, Outlook, FastMail all do).
- A second device (or second EAS preview build) for the driver app, since the broker and driver flows run as different accounts.

---

## Set variables once

```bash
API=https://sahid-freight-production.up.railway.app
MY_EMAIL=office@vanguardveil.com      # ⬅ change to your real inbox (last run: office@vanguardveil.com, the inbox connected to Claude)

BROKER_EMAIL="${MY_EMAIL/@/+broker@}"
OWNER_EMAIL="${MY_EMAIL/@/+owner@}"
DRIVER_EMAIL="${MY_EMAIL/@/+driver@}"

BROKER_PHONE=+251911000001
OWNER_PHONE=+251911000100
DRIVER_PHONE=+251911000200
SENDER_OFFLINE_PHONE=+251911000300   # the "external" cargo owner the broker is acting for

BROKER_PASS='BrokerPass123!'
OWNER_PASS='OwnerPass123!'
DRIVER_PASS='DriverPass123!'

PLATE=AA-$(date +%d%H%M)              # plate numbers are unique across prod — fresh one per run (AA-12345 / AA-12346 are taken)
SCHEDULED_DATE=$(date -v+3d +%F)      # must be in the future; macOS date syntax (Linux: date -d '+3 days' +%F)

# sanity check
echo "broker email: $BROKER_EMAIL"
echo "owner  email: $OWNER_EMAIL"
echo "driver email: $DRIVER_EMAIL"
echo "plate: $PLATE   scheduled: $SCHEDULED_DATE"
```

---

## SECTION 1 — Create the BROKER account

> **Already done on prod** (run of 2026-11-03): `+251911000001 / BrokerPass123!` exists as `Test Broker`. If login in §1.4 succeeds, skip §1.1–§1.3. Only re-run them after a clean-slate wipe.

### 1.1 Request OTP

```bash
curl -i -X POST "$API/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$BROKER_EMAIL\",\"purpose\":\"REGISTER\"}"
```
Expect `HTTP 200` + `{"ok":true}`. **Check your inbox** for a 6-digit code from `noreply@sahidfreight.com`.

### 1.2 Verify OTP

```bash
CODE_BROKER=123456   # ⬅ PASTE the 6-digit code from the email
curl -i -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$BROKER_EMAIL\",\"code\":\"$CODE_BROKER\",\"purpose\":\"REGISTER\"}"
```
Expect `HTTP 200` + `{"verificationToken":"eyJ..."}`.

```bash
VTOKEN_BROKER="eyJ..."   # ⬅ PASTE the verificationToken from the response above
```

### 1.3 Register the broker

```bash
curl -i -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "verificationToken": "$VTOKEN_BROKER",
  "phone":             "$BROKER_PHONE",
  "fullName":          "Test Broker",
  "password":          "$BROKER_PASS",
  "role":              "BROKER",
  "country":           "ETHIOPIA",
  "city":              "Addis Ababa"
}
JSON
)"
```
Expect `HTTP 201` + `{"message":"Account created successfully","accessToken":"...","refreshToken":"...","user":{...}}`. Note: the **mobile UI doesn't expose BROKER as a signup role** — this curl is the intended path to create one.

### 1.4 Log in as the broker (to get a clean access token)

```bash
curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$BROKER_PHONE\",\"password\":\"$BROKER_PASS\"}"
```
Response: `{"accessToken":"eyJ...","refreshToken":"...","user":{...}}`.

```bash
BROKER_TOKEN="eyJ..."   # ⬅ PASTE accessToken from the login response
```

---

## SECTION 2 — Create the TRUCK_OWNER account

### 2.1 Request OTP

```bash
curl -i -X POST "$API/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_EMAIL\",\"purpose\":\"REGISTER\"}"
```
Expect `HTTP 200` + `{"ok":true}`. **Check inbox.**

### 2.2 Verify OTP

```bash
CODE_OWNER=123456   # ⬅ PASTE the 6-digit code
curl -i -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_EMAIL\",\"code\":\"$CODE_OWNER\",\"purpose\":\"REGISTER\"}"
```

```bash
VTOKEN_OWNER="eyJ..."   # ⬅ PASTE the verificationToken
```

### 2.3 Register the truck owner

```bash
curl -i -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "verificationToken": "$VTOKEN_OWNER",
  "phone":             "$OWNER_PHONE",
  "fullName":          "Test Owner",
  "password":          "$OWNER_PASS",
  "role":              "TRUCK_OWNER",
  "country":           "ETHIOPIA",
  "city":              "Addis Ababa"
}
JSON
)"
```
Expect `HTTP 201`.

### 2.4 Log in as the owner

```bash
curl -sS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$OWNER_PHONE\",\"password\":\"$OWNER_PASS\"}"
```

```bash
OWNER_TOKEN="eyJ..."   # ⬅ PASTE accessToken from the login response
```

---

## SECTION 3 — Owner pre-invites the driver's phone

This creates a `PENDING DriverInvite` row so that when the driver registers (Section 4), the API auto-links them to this owner's fleet on register.

```bash
curl -i -X POST "$API/drivers/send-invite" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"phone\":\"$DRIVER_PHONE\"}"
```
Expect `HTTP 200` + a message about the invite being sent (SMS may also be attempted; harmless if it fails — the DB row is what matters).

---

## SECTION 4 — Create the DRIVER account

The driver registers normally; because of the pre-invite from §3, they get auto-linked to the owner on register (`invitedById = owner`, but `fleetConfirmed = false` until §5).

### 4.1 Request OTP

```bash
curl -i -X POST "$API/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$DRIVER_EMAIL\",\"purpose\":\"REGISTER\"}"
```
**Check inbox.**

### 4.2 Verify OTP

```bash
CODE_DRIVER=123456   # ⬅ PASTE the 6-digit code
curl -i -X POST "$API/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$DRIVER_EMAIL\",\"code\":\"$CODE_DRIVER\",\"purpose\":\"REGISTER\"}"
```

```bash
VTOKEN_DRIVER="eyJ..."   # ⬅ PASTE the verificationToken
```

### 4.3 Register the driver

```bash
curl -i -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(cat <<JSON
{
  "verificationToken": "$VTOKEN_DRIVER",
  "phone":             "$DRIVER_PHONE",
  "fullName":          "Test Driver",
  "password":          "$DRIVER_PASS",
  "role":              "DRIVER",
  "country":           "ETHIOPIA",
  "city":              "Addis Ababa"
}
JSON
)"
```
Expect `HTTP 201` + `{"message":"Account created successfully","accessToken":"...","refreshToken":"...","user":{"id":"<uuid>",...}}`.

```bash
DRIVER_ID="..."   # ⬅ PASTE user.id from the register response
```

---

## SECTION 5 — Owner confirms the driver + creates the truck + attaches them

### 5.1 Confirm the driver (flips fleetConfirmed → true)

Required by the Stage 6a gate. Without this, the truck-assign and broker-dispatch paths will 403.

```bash
curl -i -X POST "$API/drivers/$DRIVER_ID/confirm" \
  -H "Authorization: Bearer $OWNER_TOKEN"
```
Expect `HTTP 200` + `{"ok":true}`.

### 5.2 Create the truck

```bash
curl -i -X POST "$API/trucks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{
    \"plateNumber\":    \"$PLATE\",
    \"truckType\":      \"FLATBED\",
    \"capacityTons\":   15,
    \"currentCity\":    \"Addis Ababa\",
    \"currentCountry\": \"ETHIOPIA\"
  }"
```
Expect `HTTP 201` + `{"message":"...","truck":{"id":"<uuid>","isAvailable":true,...}}`.

```bash
TRUCK_ID="..."   # ⬅ PASTE truck.id from the response
```

### 5.3 Attach the confirmed driver to the truck

```bash
curl -i -X PATCH "$API/trucks/$TRUCK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d "{\"driverId\":\"$DRIVER_ID\"}"
```
Expect `HTTP 200` + truck with `driverId` set + a `driver` object in the response. **The truck is now broker-dispatchable** (available + confirmed driver attached).

---

## SECTION 6 — Broker creates a dispatchable load

The broker posts a load on behalf of an offline cargo owner (the P3c-2 flow). Externally, the cargo owner is "Test Cargo Owner" + their phone — neither of them needs an account.

```bash
curl -i -X POST "$API/loads" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BROKER_TOKEN" \
  -d "$(cat <<JSON
{
  "title":              "Test Cement",
  "weightTons":         12,
  "truckTypeNeeded":    "FLATBED",
  "pickupCity":         "Addis Ababa",
  "pickupCountry":      "ETHIOPIA",
  "deliveryCity":       "Djibouti",
  "deliveryCountry":    "DJIBOUTI",
  "offeredPrice":       45000,
  "currency":           "ETB",
  "scheduledDate":      "$SCHEDULED_DATE",
  "externalOwnerName":  "Test Cargo Owner",
  "externalOwnerPhone": "$SENDER_OFFLINE_PHONE"
}
JSON
)"
```
Expect `HTTP 201` + `{"message":"Load posted successfully","load":{"id":"<uuid>","status":"OPEN",...}}`.

```bash
LOAD_ID="..."   # ⬅ PASTE load.id from the response (handy to know but not required for the device test)
```

---

## SECTION 7 — Summary (paste this echo block to print your creds)

```bash
cat <<EOF

────────────────────────────────────────────────
  DEVICE TEST CAST READY
────────────────────────────────────────────────

  BROKER (use this on the broker mobile build)
    phone:    $BROKER_PHONE
    password: $BROKER_PASS

  DRIVER (use this on the driver mobile build / second device)
    phone:    $DRIVER_PHONE
    password: $DRIVER_PASS

  TRUCK OWNER (in case you need to log in as them on web)
    phone:    $OWNER_PHONE
    password: $OWNER_PASS

  IDs (for direct API pokes if needed)
    DRIVER_ID: $DRIVER_ID
    TRUCK_ID:  $TRUCK_ID
    LOAD_ID:   $LOAD_ID

  Load on the board: "Test Cement" · 12t · Addis Ababa → Djibouti
  Truck waiting: plate $PLATE · FLATBED · 15t · Addis Ababa
────────────────────────────────────────────────

EOF
```

---

## On-device flow to walk through

1. **Broker mobile:** log in → Dashboard → "Needs a truck" section shows **Test Cement** → tap → **Find a Truck** → your `$PLATE` truck (last run: **AA-12346**) appears with the BEST MATCH pill (driver attached, near pickup, sufficient capacity) → **Dispatch this truck** → confirm.
2. **Driver mobile** (second device): log in → Home shows the **Test Cement** job card immediately (P3e fix copied `truck.driverId → booking.driverId` on dispatch).
3. **Driver:** tap the big **Go online** toggle → grant location permission → toggle turns teal/green.
4. **Driver:** tap **Start trip** → confirm → status flips to IN_TRANSIT → live tracking begins.
5. **Broker dashboard:** "In transit" section now shows the dispatch with a LIVE pill. Tap → tracking screen shows the truck's position (updated every ~10s).
6. **Driver:** tap **Mark delivered** → confirm → booking → COMPLETED, load → DELIVERED.
7. **Broker:** open **Earnings** tab → the booking appears under **needs collection** (amber COLLECT pill) → tap **Record payment received** → enter your cut (e.g. 5000) + optional owner payout (e.g. 40000) → save.
8. The row flips to **needs payout** → tap **Mark owner paid** → confirm. Pill turns teal **SETTLED**. ✓

---

## If something goes sideways

- **"Phone number already registered"** during register → you've run this before with the same phone. Either delete the user from the DB or change `BROKER_PHONE`/`OWNER_PHONE`/`DRIVER_PHONE` to fresh values at the top.
- **"Plate number already registered"** on `POST /trucks` → plates are globally unique on prod. Use a fresh `PLATE` (the variable block generates one per run).
- **400 on `POST /loads` about scheduledDate** → the date is in the past. `SCHEDULED_DATE` is computed at the top; re-run that block.
- **"Verification expired or invalid"** during register → the verificationToken JWT lives 10 minutes. Restart that section from the request-otp step.
- **403 on `POST /drivers/$DRIVER_ID/confirm`** → you're using `BROKER_TOKEN` instead of `OWNER_TOKEN`. The confirm endpoint is fleet-manager only.
- **403 on broker dispatch** → driver wasn't confirmed (skipped §5.1) or the truck has no driver (skipped §5.3). Re-run §5.
- **Driver app shows empty Home after dispatch** → confirm the prod API is on commit `9945a6e6` or newer (P3e — broker→driver loop fix). Before that, `booking.driverId` was null and the driver wouldn't see anything.
- **Tracking pings not showing on broker side** → confirm the prod API is on commit `9945a6e6` or newer (P3e — accepts `{latitude, longitude}` from mobile). Before that, the location PATCH silently 400ed.

---

## Last run — 2026-11-03 (prod)

| Role | Phone | Email used | ID |
|---|---|---|---|
| Broker | +251911000001 | aminsahid000+broker@gmail.com | 28a94110-b77f-40cb-bf4b-98c10c6af76c |
| Truck owner | +251911000100 | office+owner@vanguardveil.com | 50bf415e-dc73-443d-b3cb-a41c760f432e |
| Driver | +251911000200 | office+driver@vanguardveil.com | 05b0314d-4c8b-4d0b-8b8e-bd1769a6408e |

- Truck **AA-12346** (FLATBED, 15t, Addis Ababa): `ae687706-f562-4a6e-a3b6-9410dc867018` — driver attached, available.
- Load **Test Cement** (12t, Addis Ababa → Djibouti, scheduled 2026-11-06, OPEN): `c5cd6f41-245a-4db8-83aa-11922422b7e7`.
- Phones above are now registered; to re-run from scratch, pick new `*_PHONE` values or run `apps/api/scripts/clean-slate.ts --delete`.
