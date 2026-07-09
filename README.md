# DotaVault

A fast, modern Dota 2 stats tracker built with React 19 and TanStack Router.

**Live site: [dotavault.mliem.com](https://dotavault.mliem.com)**

## MOTIVATION

Every stats site treats Dota like a spreadsheet with a logo slapped on top: dated layouts, sluggish page loads, and an interface that looks nothing like the game it's tracking. DotaVault exists because the client itself, dark panels, gold accents, animated hero portraits, is the actual aesthetic Dota players already know and trust, so the stats screen should feel like it too.

It started as a personal project to dig into the OpenDota API and see how far a modern React stack (TanStack Router/Query, Tailwind v4) could push a data-heavy site before it started feeling sluggish, and turned into an attempt to build the match/hero/player browser that should have shipped alongside the client in the first place.

## FEATURES

- **Match pages**: full scoreboard with timeline scrubber showing per-player gold, items, kills and deaths at any minute
- **Player profiles**: win/loss record, recent matches, hero stats, rank badge
- **Hero pages**: stats, durations, item timings
- **Meta page**: top heroes per lane position by Immortal bracket win rate
- **Pro matches**: recent professional match results
- **Team pages**: roster sorted by role, team stats
- **Search**: player names, Steam IDs (all formats), match IDs, Steam profile URLs, DotaBuff/DotaMax links, custom Steam vanity URLs

## TECH

- React 19 + TanStack Router (file-based routes) + TanStack Query
- Tailwind v4 + Vite
- Bun monorepo with Turborepo
- Data from [OpenDota API](https://docs.opendota.com) (no API key required)
- Static assets (hero/item/rank icons) self-hosted as WebP

## DEVELOPMENT

```sh
bun install
bun run dev
```

## DEPLOY

Deployed automatically to Cloudflare Pages on push to `main`.
