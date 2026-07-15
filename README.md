# OpenRun 🏀

Find a pickup game near you.

- **Live map** of basketball courts around your current location (data from OpenStreetMap via the Overpass API)
- **Estimated busyness** per court based on time of day, day of week, court capacity (# hoops), lighting, and amenities — visualized as a colored marker with a 12-hour mini-forecast
- **Shareable availability calendar** — mark the hours you can hoop and share a link; your schedule is encoded in the URL, no backend required

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Leaflet / react-leaflet + OpenStreetMap tiles
- Overpass API for court discovery

## Run locally

```bash
npm install
npm run dev
# http://localhost:3000
```

## Deploy

Zero-config on Vercel — push to `main` and import the repo. No env vars required.

## How the busyness estimate works

There's no public real-time occupancy feed for random outdoor courts, so OpenRun
synthesizes a defensible estimate from signals we *do* have:

- **Hour-of-day curve** — dead overnight, ramps through the day, peaks 5–8pm
- **Day-of-week factor** — weekends busier than mid-week
- **Capacity proxy** — `hoops` tag if OSM has it, otherwise a sensible default
- **Amenity boosts** — `lit=yes` extends the evening peak; `covered=yes` softens weather sensitivity; `access=private` damps down
- **Deterministic per-court jitter** so identical-looking parks don't read identically

Output: `{ low, mid, high, label }` where label ∈ empty / light / moderate / busy / packed.
See [`src/lib/busyness.ts`](src/lib/busyness.ts).

## How the calendar sharing works

7×24 boolean grid → 21 bytes → base64url in the `?cal=` query param.
Your friend opens the link, their client decodes it, no server involved.
See [`src/lib/availability.ts`](src/lib/availability.ts).

## License

MIT
