# Club Finder

Guest-facing discovery for a night out in Bucharest. The app asks for location, opens a map of upcoming club nights, and ranks them in a list you can actually read: name, time, distance, genre, average ticket.

This is the first demo: one city, placeholder venues, no accounts, no tickets. Product rules live in [PRODUCT.md](PRODUCT.md).

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Ranking, schedule, and seed checks |
| `npm run build` | Type-check and production build, including the PWA service worker |
| `npm run preview` | Serve `dist/` locally |
| `npm run icons` | Regenerate PWA icons from `public/icon.svg` |

## What you get

On first visit in a tab:

1. **Location** — allow, or continue with Bucharest. Outside the city, denied, or unavailable all fall back to Piața Unirii with a banner.
2. **Interests** — up to three genres and an optional budget. Skip is fine; the rank then uses tonight, distance, and how soon it starts.
3. **Home** — MapLibre map of every venue that still has an upcoming event, plus a ranked list. Same-day pins glow. Clusters light up when they contain a tonight event.
4. **Event** — `/events/:id`. Address, hours, placeholder rating, night-out price level (not the ticket price), and a link out to maps. Ticketing is a sentence, not a fake checkout.

A refresh in the same tab comes back to home. A new session starts at location again.

The Blacklight design-system showcase is at `/design-system`.

## Layout

Phone: map holds the top of the viewport, list scrolls under it. Desktop: map on the left, list (or the open event) on the right.

## Data

There is no backend. Venues and events are a typed module in `src/data/bucharest.ts`. Starts are offsets from load time (today / coming Saturday / minutes from now), so “tonight” does not go stale. Covers and venue photos are local JPEGs in `public/photos`.

“For you” is the weighted sum in PRODUCT.md. The list and the map share `src/data/discovery.ts` for upcoming, same-day, and score.

## Tickets

Passes are issued and scanned only by Cloud Functions in `functions/` (region `europe-west1`). The browser reads its own `tickets` documents and never writes them. No payment is taken yet, and there are no refunds.

- **Ticket id:** 16 random bytes in base64url (`randomBytes(16)`), created on the server. Knowing the id alone does not get anyone in.
- **Per-ticket key:** `HMAC-SHA256(TICKET_HMAC_KEY, ticketId + keyVersion)`. It is never stored. The master key stays in Secret Manager.
- **QR code:** `CF1.<ticketId>.<counter>.<mac>`. The code changes every 2 minutes and is computed on the phone with WebCrypto, so it works without signal. The door accepts the current period and one period either side, so a screenshot stops working within a few minutes.
- **Scanning:** `/scan/:eventId` is open to the organizer, admins, and door staff the organizer adds in the event editor. A pass goes from valid to used inside a Firestore transaction, so it gets in once. Every attempt is logged under `events/{id}/scans`.
- **Limits:** prices and stock are computed on the server. An order holds at most 8 passes, an account at most 8 per night, and a retried request can't create a second order.
- **Reset QR:** the owner can reset a pass's code. Any copied key or screenshot stops working.

Shared rules (tiers, fee, code format) live in `shared/ticketing.ts`, imported by both the app and the functions.

### Already enforced in code

A leaked database or a modified browser cannot mint a valid pass.

- Ticket ids are 128 random bits from the server. The id is not a secret, and it does not admit anyone.
- Each pass has an HMAC key derived from `TICKET_HMAC_KEY`. That master secret is only in Secret Manager. The derived key is never written to Firestore, so a database export is not enough to forge a QR.
- The QR is `CF1.<ticketId>.<counter>.<mac>` and changes every 2 minutes on the phone. The door accepts the current period and one period either side. A screenshot dies within a few minutes. The server compares the MAC with `timingSafeEqual`.
- Redeeming a pass is one Firestore transaction from `valid` to `used`. Two scanners cannot both succeed. Every attempt is stored at `events/{id}/scans`.
- Only an admin, the event's organizer, or a door-staff row that organizer added can scan. The buyer cannot mark their own pass used. Reset QR bumps `keyVersion` and kills copied codes.
- The client cannot write `tickets`, `orders`, `ticketStock`, `ticketHolders`, `events/{id}/staff`, or `events/{id}/scans`. Prices, stock, and the 8-pass caps are decided on the server. A retried checkout reuses the same order id. An event with sales cannot be deleted.
- Deployed callables require an App Check token. The emulator does not. The local key cache is wiped on sign-out.

### Still required before this is safe in production

The code does nothing until the project is configured and deployed. Do these, and do not treat ticket sales as live before the last one.

1. Keep the project on Blaze, in `ecospheredigitalapp-org`, billed to the Ecosphere billing account. Close the old billing account only after the project shows the new one. Trial credit does not move.
2. `TICKET_HMAC_KEY` must be a fresh 32-byte secret in Secret Manager, never in git, `.env`, or chat. Set it once and leave it. Replacing it invalidates every QR until each phone fetches keys again. The emulator copy belongs only in `functions/.secret.local`.
3. Finish App Check as written below, including `VITE_APPCHECK_SITE_KEY`. Deployed functions reject calls with no token.
4. `firebase deploy --only functions,firestore:rules` from this repo. Until that deploy succeeds, the doors and the checkout are not the system described here.
5. Before a public event, revoke any App Check debug token that was copied into chat, a screenshot, or a shared machine. Localhost needs a token that stays private. Production builds do not send it.
6. Remove the Neuroweb user from the project's IAM once Ecosphere can open the project and the billing account alone.

These are still open on purpose. They are the next safety work, not bugs in the current pass.

- There is no payment. App Check stops a dumb script, not a person who can pass the browser check and open many accounts. Each account can still take 8 passes. Charge with Stripe, and issue passes only from the paid webhook, before a night can sell out.
- Email addresses are not verified. A typo or a throwaway inbox still gets a pass.
- The scanner needs a network connection. There is no offline door mode.
- There are no refunds and no transfer of a pass to another account.
- Do not turn on App Check enforcement for Firestore, Storage, or Authentication. Ticket writes are already impossible from the client. Enforcing it there would break the maintenance scripts.

### One-time setup

1. Put the Firebase project on the Blaze plan (Cloud Functions need it).
2. Install the CLI (`npm i -g firebase-tools`), run `firebase login`, then `npm --prefix functions install`.
3. Create the master key and store it as a secret. It must be at least 32 random bytes, base64-encoded:
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, then `firebase functions:secrets:set TICKET_HMAC_KEY` and paste the value.
4. Register App Check with Fraud Defense, as below.
5. `firebase deploy --only functions,firestore:rules`.

For local work without App Check, run `firebase emulators:start` and set `VITE_USE_EMULATORS=true` in `.env`. The functions emulator needs `TICKET_HMAC_KEY` in `functions/.secret.local`.

### App Check

Deployed ticket functions reject calls that have no App Check token. The provider is Fraud Defense (reCAPTCHA Enterprise), wired in `src/data/firebase.ts` with `ReCaptchaEnterpriseProvider`. Do not use the deprecated reCAPTCHA classic provider.

The value is the **Key ID** of the Fraud Defense key named `club-finder-web`, created in Google Cloud under the `club-finder` project (Security → Fraud Defense). It is not `VITE_FIREBASE_API_KEY` and not a key from APIs & Services → Credentials.

Key settings that must stay as they are: platform **Web**, score-based (Challenge, Test key, and WAF all off), domains `localhost`, `club-finder-e55bc.web.app`, and `club-finder-e55bc.firebaseapp.com`. In Firebase → App Check → Apps, register that Key ID on the web app under **Fraud Defense**. Token lifetime **1 hour**, app risk **Medium (0.5)**. Do not enforce App Check on Firestore, Storage, or Authentication. The ticket functions already require it.

`.env`:

```
VITE_APPCHECK_SITE_KEY=<Fraud Defense Key ID>
VITE_APPCHECK_DEBUG_TOKEN=<debug token>
```

Restart `npm run dev` after either change. Vite reads `.env` only at startup.

**Debug token.** Localhost cannot pass a real attestation. Create a token in Firebase → App Check → Apps → the web app menu → Manage debug tokens, and set that same value as `VITE_APPCHECK_DEBUG_TOKEN`. The app does not print the token. Keep it while this machine is used for development. It bypasses the check, so do not commit it or paste it in chat. Revoke it in that same Manage debug tokens screen when this machine is no longer used for development, or if the token leaked. After a revoke, localhost fails until a new token is registered. Production builds never send the debug token, so revoking it does not affect the live site.

### Where the project lives

`club-finder` (id `club-finder-e55bc`) is in the Google Cloud organization `ecospheredigitalapp-org`. Moving it there does not change the project id, Firestore, Auth, or the `.env` Firebase keys. Billing is a separate account from the project: change it while logged in as an Ecosphere user who owns both the project and the target billing account, at `console.cloud.google.com/billing/linkedaccount?project=club-finder-e55bc`. Link the new account before closing the old one. Trial credit stays on the old billing account.

Set a billing **email alert** at about $5 and $20. Do not set a Functions spending cap that pauses the service. `redeemTicket` is the door. If the cap trips during a night, scanning stops. These functions stay inside the free tier at a normal event, and each one is already limited to 10 instances.

## Stack

React 19, Vite, TypeScript, React Router, MapLibre GL JS, OpenFreeMap tiles (no token), `vite-plugin-pwa`, Firebase (Auth, Firestore, Cloud Functions, App Check). 
