---
name: DotaVault
description: A fast, modern Dota 2 stats tracker that feels native to Dota 2 itself.
colors:
  bg-void: "#0b0b0d"
  bg-html: "#08080a"
  bg-card: "#16130f"
  border-default: "#2a2620"
  border-panel: "#24222a"
  border-hairline: "#1c1810"
  text-muted: "#8a8474"
  text-muted-dim: "#5a5648"
  text-foreground: "#dcd6c8"
  accent-info: "#5a8fc2"
  radiant-win: "#8ec63f"
  radiant-win-alt: "#8fbf3f"
  dire-loss: "#d14a38"
  dire-loss-alt: "#c94a38"
  gold: "#c9a94a"
  gold-bright: "#f2c94c"
  attr-strength: "#e24b3a"
  attr-agility: "#a2d240"
  attr-intelligence: "#4fb0e0"
  attr-universal: "#c47adf"
typography:
  display:
    fontFamily: "Reaver, serif"
    fontSize: "clamp(1.5rem, 4vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  body:
    fontFamily: "Radiance, 'Geist Variable', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Radiance, 'Geist Variable', sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.15em"
  mono:
    fontFamily: "'Geist Mono Variable', monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  none: "0px"
  sm: "2px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  panel:
    backgroundColor: "rgba(12,11,14,0.72)"
    textColor: "{colors.text-foreground}"
    rounded: "{rounded.none}"
    padding: "16px"
  tab-active:
    backgroundColor: "{colors.gold}"
    textColor: "#0b0b0d"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  tab-inactive:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  badge-private:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.none}"
    padding: "2px 6px"
---

# Design System: DotaVault

## 1. Overview

**Creative North Star: "The Client Overlay"**

DotaVault is built to feel like a panel that could have shipped inside the Dota 2 client itself, not a third-party website bolted on top of the game. It self-hosts Valve's actual web fonts (Radiance for UI text, Reaver for display headings) and borrows the game's own semantic vocabulary directly: Radiant green for wins, Dire red for losses, a muted gold for emphasis. Nothing here is a generic dashboard skin wearing esports colors; every choice traces back to something the audience already recognizes from hundreds of hours inside the game's own UI.

The audience is competitive and hardcore players who arrive with a specific lookup already in mind. The design serves that: dense tables, compact rows, minimal chrome, zero onboarding copy. It explicitly rejects the generic SaaS/AI dashboard aesthetic (cream backgrounds, gradient text, card-grid-everything, tiny uppercase eyebrow labels above every section) in favor of the flat, near-black, sharp-edged surface Dota 2's own interface already uses.

**Key Characteristics:**
- Near-black void background, never a light theme
- Valve's own Radiance and Reaver fonts, self-hosted, not a lookalike
- Sharp corners everywhere except circular avatars, matching Dota 2's own UI geometry
- Color carries meaning (win/loss, radiant/dire, hero attribute) before it carries decoration
- Data honesty: incomplete or approximate data is labeled as such, never hidden or faked

## 2. Colors

The palette is a near-black void punctuated by exactly the colors Dota 2 itself already uses to mean something: green for winning, red for losing, gold for value/emphasis, and the four hero-attribute colors from the game's own hero pages.

### Primary
- **Aegis Gold** (`#c9a94a`): the one warm accent. Marks the active tab/pill, badges, hover-worthy emphasis, and anything the page wants a competitive player's eye to land on first. A brighter variant, **Immortal Gold** (`#f2c94c`), is reserved for rank/leaderboard emphasis (the Immortal-tier badge, leaderboard rank pills) where the standard gold would read too muted against the Immortal medal art.

### Secondary
- **Radiant Green** (`#8ec63f`, match-internal variant `#8fbf3f`): wins, the Radiant side, positive win-rate deltas, "this connector line is a confirmed winner's path" in the bracket view.
- **Dire Red** (`#d14a38`, match-internal variant `#c94a38`): losses, the Dire side, negative deltas. The two variants aren't drift, they mark two different contexts: the `8ec63f`/`d14a38` pair reads as "result" (league standings, series outcomes), the `8fbf3f`/`c94a38` pair reads as "side" (which team a player was on, inside a single match's own UI chrome).

### Tertiary
- **Attribute Quartet**: Strength `#e24b3a`, Agility `#a2d240`, Intelligence `#4fb0e0`, Universal `#c47adf`, lifted directly from dota2.com's own hero pages. Used only where a hero's primary attribute is the actual subject (hero pages, draft stat coloring), never as a general-purpose accent set.
- **Scouting Blue** (`#5a8fc2`): the one color with no in-game precedent, used sparingly for informational accents that aren't win/loss/attribute-coded.

### Neutral
- **Void Black** (`#0b0b0d`, page chrome `#08080a`): the base. Everything sits on this, there is no light-theme fallback.
- **Ember Card** (`#16130f`): the warmest neutral in the system, a near-black card tone with a faint ember undertone, distinct from pure void.
- **Panel Border** (`#24222a`) / **Hairline Border** (`#1c1810`): panel-level borders vs. the finer 1px hairlines between table rows, respectively.
- **Foreground** (`#dcd6c8`): primary text on dark, a warm off-white, never pure `#fff` for body copy.
- **Muted** (`#8a8474`, dimmer `#5a5648`): secondary text, timestamps, unselected tab labels, column headers.

### Named Rules
**The Named-Color Rule.** Every color in this system either comes from Dota 2's own UI/lore vocabulary (Radiant, Dire, Aegis Gold, the four attribute colors) or is a deliberately restrained neutral. If a new color is ever needed, ask first whether Dota 2 already has a name for it before inventing one.

## 3. Typography

**Display Font:** Reaver, serif (with generic `serif` fallback)
**Body Font:** Radiance, sans-serif (with `Geist Variable`, `sans-serif` fallback)
**Mono/Tabular Font:** `Geist Mono Variable`, monospace (used for a handful of true monospace contexts; most tabular numbers instead use Radiance with a `tabular-nums` feature, see the Named Rule below)

**Character:** Reaver is a serif with real weight and presence, reserved for headings people scan for once (league name, match ID, page title). Radiance is Valve's own compact UI sans, doing essentially all of the reading-heavy work: stat tables, labels, player and hero names, timestamps. The pairing mirrors the game client's own hierarchy: a display face for the marquee moment, a workhorse face for everything else.

### Hierarchy
- **Display** (700, `clamp(1.5rem, 4vw, 2.75rem)`, 1.1 line-height, uppercase, `0.02em` tracking): page titles (league name, match ID), the one place Reaver appears.
- **Title** (500, 18-20px, `var(--font-display)`, uppercase, `3px` letter-spacing): Panel section headers ("Team Standings", "Results", "Participants").
- **Body** (400, 13-15px, `var(--font-dota)`): table cells, player/hero/team names, list rows. Max line length isn't a concern here, rows truncate rather than wrap.
- **Label** (700, 11-12px, `var(--font-dota)`, uppercase, `1-2px` letter-spacing): column headers, tab labels, badges ("Private", "Pro"), round labels in the bracket view.
- **Numeric/Tabular** (400-700, 12-16px, `var(--font-dota)` + `tabular-nums`): scores, win rates, ranks, durations. Always tabular so columns of numbers align.

### Named Rules
**The Uppercase-Label Rule.** Any text acting as a label rather than content (section titles, column headers, tab text, badges) is uppercase with positive letter-spacing. Body content (names, values) is never uppercased.

## 4. Elevation

Flat by default. Panels and cards sit directly against the void background, differentiated by background-darkness tiers (`rgba(12,11,14,0.72)` panel vs. `rgba(8,10,12,0.7-0.9)` header strips vs. plain void beneath) and 1px borders, not drop shadows. Shadow is reserved for moments something needs to visually separate from the flat layout underneath it: a tooltip floating over content, a hero portrait or ability icon that needs to read as "lifted" above a busy background, or an inset accent marking the active row in a roster/timeline list.

### Shadow Vocabulary
- **Tooltip/floating panel** (`box-shadow: 0 6px 24px rgba(0,0,0,0.7)`): ability tooltips, hovering detail panels.
- **Ambient portrait glow** (`box-shadow: 0 0 32px 8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)`): a hero/ability image that needs to separate from a media-heavy background.
- **Active-row inset accent** (`box-shadow: inset 3px 0 0 <accent-color>`): marks the selected row in a roster or player-timeline list, a colored inset edge rather than a lift.
- **Text legibility shadow** (`text-shadow: 0 1px 3px rgba(0,0,0,0.9)`, sometimes stacked with a second softer `0 2px 10px rgba(0,0,0,0.7)`): applied liberally to text sitting over the background artwork or team logos, not a decorative effect, a contrast fix.

### Named Rules
**The Flat-By-Default Rule.** Nothing gets a drop shadow just for being a card. Shadow is a functional answer to "this needs to read as above something else," never a default treatment for containers.

## 5. Components

### Buttons / Tab Pills
- **Shape:** square corners, no radius (`0px`), matching the game client's own UI chrome.
- **Active:** solid Aegis Gold background (`#c9a94a`), near-black text (`#0b0b0d`), uppercase, `1-2px` letter-spacing.
- **Inactive:** transparent or `rgba(255,255,255,0.05)` background, muted text (`#8a8474` / `#7d8b95` depending on surface), same uppercase treatment.
- **Hover:** inactive tabs pick up `hover:bg-white/[0.03]` to `[0.05]` and/or a text-color shift toward foreground; no active-state hover treatment beyond the tab already being filled.

### Badges
- **Style:** small uppercase text with a thin (`1px`) border, no fill, no radius. `Private` badge uses muted colors (`#8a8474` text/border); `Pro` badge uses gold-tinted colors (`#c9a94a` text, `rgba(201,169,74,0.5)` border).
- **Placement:** inline, immediately beside the name it qualifies, never a separate row.

### Panels / Containers
- **Corner Style:** square, `0px` radius, no exceptions for panel-level containers.
- **Background:** `rgba(12,11,14,0.72)` for the panel body, a darker `rgba(8,10,12,0.7-0.9)` strip for the title/header bar sitting on top of it.
- **Shadow Strategy:** none by default (see Elevation).
- **Border:** `1px solid #24222a` around the whole panel; internal row dividers use the finer `#1c1810` hairline instead.
- **Internal Padding:** `16px` horizontal, `8-12px` vertical for the header strip; `8px` vertical rhythm between table rows.

### Tables / Data Rows
- **Style:** no visible grid lines; rows separated by a `1px` top hairline border (`#1c1810`), alternating rows optionally tinted `rgba(255,255,255,0.02)` for scan-ability in long lists.
- **Hover:** `rgba(255,255,255,0.03-0.05)` background wash on the whole row when the row itself is a navigation target.
- **Numeric columns:** always right-aligned, always `tabular-nums`.

### Avatars / Icons
- **Team logos, hero icons, item icons:** square or lightly-rounded (`rounded-sm`, `2px`), never fully rounded, matching the game's own icon geometry.
- **Player avatars:** the one exception, fully circular (`rounded-full`), matching Steam's own avatar convention that players already recognize.

### Bracket Connector Lines (signature component)
Thin (`1.5px`) SVG elbow paths connecting a match to whichever match its winner advances to, colored Radiant Green (`#8ec63f`) when the connection is a confirmed winner's path, muted (`#5a5648`) otherwise (a Swiss-stage carry-over, a bye, or a connection the underlying data can't confirm). A connector is never drawn if doing so would visually cross an unrelated round's cards, silence (no line) is preferred over a misleading one.

## 6. Do's and Don'ts

### Do:
- **Do** name colors after Dota 2's own vocabulary first (Radiant, Dire, Aegis Gold, the attribute quartet) before inventing a new descriptive name.
- **Do** keep corners square (`0px` radius) for every panel, card, button, and badge; reserve full rounding for player avatars only.
- **Do** label incomplete or inferred data honestly (`Player <id>`, `Team <id>`, a "Private" badge, an "Approximate round grouping" disclaimer) rather than hiding the gap or fabricating a value.
- **Do** use uppercase with positive letter-spacing for labels (section titles, column headers, tab text, badges); leave body content in normal case.
- **Do** keep tables dense: compact row height, right-aligned tabular numbers, hairline dividers, no card-per-row treatment.

### Don't:
- **Don't** use a cream, off-white, or light theme background anywhere. The void background (`#0b0b0d` / `#08080a`) is non-negotiable.
- **Don't** use gradient text, card-grid-everything layouts, or tiny uppercase eyebrow labels above every section, the generic SaaS/AI dashboard aesthetic this project explicitly rejects.
- **Don't** add a drop shadow to a panel or card just because it's a container; shadow is reserved for tooltips, floating portraits, and active-row accents (see Elevation).
- **Don't** round panel, card, or button corners. Square corners are the default; only player avatars break this rule.
- **Don't** draw a bracket connector line (or any inferred relationship) across data the underlying source can't actually confirm; skip the line rather than mislead.
