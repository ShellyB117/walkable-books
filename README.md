# Walkable Books

Discover books curated from Goodreads and Hardcover that you can walk to — with tags, similar titles, and nearby libraries & bookstores on a map.

Inspired by the cozy vibe of [Messenger](https://messenger.abeto.co/) (abeto.co).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTESERVICE_API_KEY` | Recommended | Geocoding & walking times — [openrouteservice.org](https://openrouteservice.org/) |
| `HARDCOVER_API_TOKEN` | Optional | Book tags & metadata — [hardcover.app/settings](https://hardcover.app/settings) |
| `NEXT_PUBLIC_MAP_STYLE` | Optional | MapLibre style URL |
| `CRON_SECRET` | Production | Bearer token for daily Vercel cron sync |

Without API keys the app still works: walking times fall back to straight-line estimates, and tags come from Open Library subjects.

## Features

- **Import** your Goodreads library via CSV export
- **Follow curators** from Goodreads (RSS) or Hardcover public lists
- **Recommendations** scored by taste overlap + walkability
- **Book detail** with tags, similar books, map, and WorldCat links
- **Daily sync** of curator shelves via `/api/cron/sync`

## Scripts

```bash
npm run dev        # Development server
npm run build      # Production build
npm run db:push    # Push Drizzle schema to SQLite
npm run sync       # Trigger curator sync (dev server must be running)
```

## Data sources

- Goodreads CSV / RSS (public shelves)
- Hardcover GraphQL API
- Open Library (fallback metadata)
- OpenStreetMap Overpass (nearby libraries, bookstores, Little Free Libraries)
- OpenRouteService (walking times)

## License

MIT
