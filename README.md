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

There is no backend. Venues and events are a typed module in `src/data/bucharest.ts`. Starts are offsets from load time (today / coming Saturday / minutes from now), so “tonight” does not go stale. Covers are generated placeholders, labelled as such.

“For you” is the weighted sum in PRODUCT.md. The list and the map share `src/data/discovery.ts` for upcoming, same-day, and score.

## Stack

React 19, Vite, TypeScript, React Router, MapLibre GL JS, OpenFreeMap tiles (no token), `vite-plugin-pwa`.
"# club-finder" 
