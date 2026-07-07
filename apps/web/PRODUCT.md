# Product

## Register

product

## Users

Competitive and hardcore Dota 2 players and fans. They already know the game deeply: checking their own or a pro player's stats, scouting an upcoming opponent, following a tournament's bracket, comparing hero matchup data. They arrive with a specific lookup in mind, often mid-conversation or while following a live event, and they're comfortable with dense tables, jargon, and Dota's own conventions (radiant/dire, MMR, lane roles, item timings). They value speed and density over explanation or hand-holding.

## Product Purpose

DotaVault is a fast Dota 2 stats tracker: match pages with a full scoreboard and timeline scrubber, player profiles, hero pages, a meta page, pro match results, team pages, league reports (standings, results, draft, bracket, participants), and search across players/matches/Steam profiles. Data comes from the public OpenDota API, which is itself incomplete and approximate for some fields (no official bracket-slot data, team/player names capped to a top-N list, some profiles never resolved). Success looks like: a user finds the specific stat they came for quickly, and when the underlying data is incomplete, the page says so honestly rather than guessing or breaking.

## Brand Personality

Precise, immersive, no-nonsense. DotaVault deliberately mirrors Dota 2's own visual language, Valve's actual web fonts (Radiance for UI text, Reaver for display), and the game's own semantic colors (radiant green, dire red, gold), self-hosted rather than approximated. This is not decorative theming: for an audience that already lives inside Dota 2's own UI, looking and feeling native to that world is what reads as credible and "made by someone who gets it." The personality is earned through accuracy and restraint, not through flourish.

## Anti-references

The generic SaaS/AI dashboard aesthetic: cream or off-white backgrounds, gradient text, card-grid-everything, tiny uppercase tracked eyebrow labels above every section. That aesthetic would clash directly with the deliberate Dota-native identity already in place (near-black background, Dota's own fonts and colors) and would read as generic rather than authentic to the game it's about.

## Design Principles

- **Feel native to Dota 2, not themed to look like it.** Use Valve's own fonts and the game's own semantic colors deliberately and consistently, not as a one-off skin over an otherwise generic layout.
- **Density over hand-holding.** Assume domain fluency. Prioritize scan-speed and information density (compact tables, inline stats, minimal chrome) over onboarding, tooltips, or explanatory copy a competitive player wouldn't need.
- **Data honesty over polish.** When OpenDota's data is incomplete or approximate, say so rather than hiding it or guessing: label inferred structure as inferred, show `Player <id>` / `Team <id>` rather than a fabricated name, mark a profile "Private" rather than pretending it's public, skip rendering a relationship the data can't actually support rather than rendering it wrong.
- **Consistency over novelty.** Reuse established patterns (panel chrome, badge styles, link/active-state conventions, fallback-data patterns) rather than inventing a new one for each new surface.
- **Never let incomplete third-party data break the page.** OpenDota is a third-party aggregator with real gaps. Every surface should degrade gracefully when data is missing, partial, or delayed, never crash, never show a blank page where a graceful fallback is possible.

## Accessibility & Inclusion

Standard baseline: sufficient color contrast for body and data text, respect `prefers-reduced-motion` where animation is used, no specific WCAG level target or additional user needs beyond general good practice at this time.
