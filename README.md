# DotaVault

A fast, modern Dota 2 stats tracker built with React 19 and TanStack Router.

**Live site: [dotavault.mliem.com](https://dotavault.mliem.com)**

## Features

- **Match pages** — full scoreboard with timeline scrubber showing per-player gold, items, kills and deaths at any minute
- **Player profiles** — win/loss record, recent matches, hero stats, rank badge
- **Hero pages** — stats, durations, item timings
- **Meta page** — top heroes per lane position by Immortal bracket win rate
- **Pro matches** — recent professional match results
- **Team pages** — roster sorted by role, team stats
- **Search** — player names, Steam IDs (all formats), match IDs, Steam profile URLs, DotaBuff/DotaMax links, custom Steam vanity URLs

## Tech

- React 19 + TanStack Router (file-based routes) + TanStack Query
- Tailwind v4 + Vite
- Bun monorepo with Turborepo
- Data from [OpenDota API](https://docs.opendota.com) (no API key required)
- Static assets (hero/item/rank icons) self-hosted as WebP

## Development

```sh
bun install
bun run dev
```

## Deploy

Deployed automatically to GitHub Pages on push to `main`.
