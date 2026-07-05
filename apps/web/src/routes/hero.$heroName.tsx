import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { AbilityDetails } from '@/components/heroes/ability_details'
import { Spinner } from '@/components/ui/spinner'
import { datafeed } from '@/lib/datafeed'
import { usePageTitle } from '@/lib/title'
import { opendota } from '@/lib/opendota'
import {
  INNATE_ICON_CDN,
  ITEM_CDN_FALLBACK,
  TALENTS_ICON_CDN,
  abilityIconCdn,
  abilityIconUrl,
  heroIconUrl,
  heroLandscapeCdn,
  heroSlug,
  itemIconUrl,
} from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroName')({
  component: HeroDetailPage,
})

const ATTR: Record<string, { label: string; color: string }> = {
  str: { label: 'Strength', color: '#e24b3a' },
  agi: { label: 'Agility', color: '#a2d240' },
  int: { label: 'Intelligence', color: '#4fb0e0' },
  all: { label: 'Universal', color: '#c47adf' },
}

// The same animated, transparent hero render dota2.com uses on its hero pages.
const RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders'
function heroRenderPoster(short: string): string {
  return `${RENDER}/${short}.png`
}

// Per-hero render placement overrides, ported verbatim from dota2.com's CSS.
// The base wrapper centers the square render in a 75%-wide, banner-height box;
// these nudge heroes whose model would otherwise sit off-center.
const RENDER_TWEAKS: Record<string, React.CSSProperties> = {
  abaddon: { alignItems: 'flex-start', top: '-3%' },
  bloodseeker: { maxWidth: 1400, right: 0 },
  primal_beast: { width: '100%', right: '-22%' },
  broodmother: { width: '100%', right: '-20%' },
  largo: { top: '6%' },
  bristleback: { right: '5%' },
  dawnbreaker: { right: '-10%' },
  puck: { minHeight: 0, width: '50%', right: '5%', top: '-5%' },
  sniper: { minHeight: 0, width: '40%', right: '10%', top: '-5%' },
  kez: { top: '-10%', right: '-20%', width: '100%' },
  hoodwink: { width: '40%' },
  meepo: { top: '-10%' },
}

// dota2.com's own attribute and per-stat icons (used in the header and stat bar).
const REACT_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react'
const ATTR_ICON_NAME: Record<string, string> = {
  str: 'strength',
  agi: 'agility',
  int: 'intelligence',
  all: 'universal',
}
const attrIconUrl = (a: string) => `${REACT_CDN}/icons/hero_${ATTR_ICON_NAME[a] ?? 'strength'}.png`
const statIconUrl = (name: string) => `${REACT_CDN}/heroes/stats/icon_${name}.png`

// Valve's hype/bio text uses <b> for emphasis; render that as bold and drop any other tags.
function HistoryText({ text }: { text: string }) {
  const cleaned = text.replace(/<(?!\/?b>)[^>]*>/gi, '')
  const parts = cleaned.split(/(<\/?b>)/i)
  let bold = false
  return (
    <>
      {parts.map((p, i) => {
        if (/^<b>$/i.test(p)) {
          bold = true
          return null
        }
        if (/^<\/b>$/i.test(p)) {
          bold = false
          return null
        }
        if (!p) return null
        return bold ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a fixed string
          <strong key={i} style={{ fontWeight: 700, color: '#e8e2d4' }}>
            {p}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a fixed string
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}

function parseTalent(dname: string): { sign: string | null; value: string | null; unit: string; text: string } {
  // Explicit numeric: "+10 All Attributes", "+5s Reflection Duration"
  const explicit = dname.match(/^([+\-])(\d+)([a-z%]*)\s+(.+)$/i)
  if (explicit) return { sign: explicit[1], value: explicit[2], unit: explicit[3], text: explicit[4] }
  // Template value: "+{s:bonus_x}s Description", "-{s:...}% Description"
  const template = dname.match(/^([+\-])\{[^}]*\}([a-z%]*)\s+(.+)$/i)
  if (template) return { sign: template[1], value: null, unit: template[2], text: template[3] }
  return { sign: null, value: null, unit: '', text: dname.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim() }
}

// The nine canonical Dota role categories, shown in the header stat bar (dota2.com order).
const ALL_ROLES = [
  'Carry',
  'Support',
  'Nuker',
  'Disabler',
  'Jungler',
  'Durable',
  'Escape',
  'Pusher',
  'Initiator',
]

// One icon + value row inside an Attack / Defense / Mobility group (dota2.com sizing: 14px/600).
function IconStat({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-[3px]">
      <img src={statIconUrl(icon)} alt="" className="h-[22px] w-[22px] shrink-0 opacity-90" />
      <span
        className="text-[14px] tabular-nums"
        style={{ color: '#fff', fontWeight: 600, fontFamily: 'var(--font-dota)' }}
      >
        {value}
      </span>
    </div>
  )
}

// A titled column (Attack / Defense / Mobility) in the stat bar. Matches dota2.com: 16px/700 grey.
function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div
        className="text-[16px] font-bold uppercase mb-2"
        style={{ color: '#969696', letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// One attribute row: attribute icon + base value (Reaver 20px/600) + growth. Matches dota2.com.
function AttrRow({ attrKey, base, gain }: { attrKey: string; base: number; gain: number }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <img src={attrIconUrl(attrKey)} alt="" className="h-7 w-7 shrink-0" />
      <span
        className="text-[20px] tabular-nums leading-none"
        style={{ color: '#fff', fontWeight: 600, fontFamily: 'var(--font-display)' }}
      >
        {base}
      </span>
      <span className="text-[15px] tabular-nums" style={{ color: '#999999' }}>
        +{gain.toFixed(1)}
      </span>
    </div>
  )
}

// A hero-total bar (health green / mana blue) with the value and growth, as under dota2.com's portrait.
function TotalBar({ fill, value, gain }: { fill: string; value: number; gain: number }) {
  return (
    <div
      className="relative flex items-center justify-between px-2 rounded-[2px] overflow-hidden"
      style={{ height: 20, background: fill }}
    >
      <span
        className="text-[13px] tabular-nums"
        style={{ color: '#fff', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        {value}
      </span>
      <span
        className="text-[12px] tabular-nums"
        style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        +{gain.toFixed(1)}
      </span>
    </div>
  )
}

function StatPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="px-4 py-3 uppercase"
        style={{ color: '#c8c2b4', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '3px', borderBottom: '1px solid #24222a' }}
      >
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

// Best/worst matchups (min-games filtered so a hero with 40 total games
// doesn't outrank one with 40,000 just from sample noise), same idea as
// Dotabuff's Counters tab. OpenDota gives this hero's own win rate against
// each opponent directly, no aggregation needed.
const MATCHUP_MIN_GAMES = 100
function MatchupsSection({
  heroMap,
  matchups,
}: {
  heroMap: Map<number, { localized_name: string; name: string }>
  matchups: { hero_id: number; games_played: number; wins: number }[]
}) {
  const rated = useMemo(
    () =>
      matchups
        .filter((m) => m.games_played >= MATCHUP_MIN_GAMES)
        .map((m) => ({ ...m, wr: (m.wins / m.games_played) * 100 })),
    [matchups],
  )
  const best = useMemo(() => [...rated].sort((a, b) => b.wr - a.wr).slice(0, 5), [rated])
  const worst = useMemo(() => [...rated].sort((a, b) => a.wr - b.wr).slice(0, 5), [rated])

  const row = (m: { hero_id: number; games_played: number; wr: number }, good: boolean) => {
    const h = heroMap.get(m.hero_id)
    return (
      <a
        key={m.hero_id}
        href={h ? `/hero/${heroSlug(h.localized_name)}` : undefined}
        className="flex items-center gap-2.5 py-1.5 hover:bg-white/[0.03]"
        style={{ borderTop: '1px solid #1c1810' }}
      >
        {h && <img src={heroIconUrl(h.name)} alt="" className="h-8 w-8 shrink-0 rounded" />}
        <span className="min-w-0 flex-1 truncate text-[16px]" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
          {h?.localized_name ?? `Hero ${m.hero_id}`}
        </span>
        <span
          className="shrink-0 text-[16px] font-bold tabular-nums"
          style={{ color: good ? '#8ec63f' : '#d14a38', fontFamily: 'var(--font-dota)' }}
        >
          {m.wr.toFixed(1)}%
        </span>
      </a>
    )
  }

  if (rated.length === 0) return null

  return (
    <StatPanel title="Matchups">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-widest mb-1" style={{ color: '#8ec63f' }}>
            Best Against
          </div>
          {best.map((m) => row(m, true))}
        </div>
        <div>
          <div className="text-[13px] font-bold uppercase tracking-widest mb-1" style={{ color: '#d14a38' }}>
            Worst Against
          </div>
          {worst.map((m) => row(m, false))}
        </div>
      </div>
      <div className="mt-3 text-[13px]" style={{ color: '#7a7464' }}>
        Minimum {MATCHUP_MIN_GAMES.toLocaleString()} games played against that hero.
      </div>
    </StatPanel>
  )
}

// Win rate by game-length bucket, the closest thing OpenDota exposes to
// Dotabuff's win-rate-trend chart (theirs buckets by hero level, this
// buckets by match duration, both read the same way as a shape).
// A flat games-played floor (rather than a % of peak) so a hero with a
// naturally spread-out duration distribution doesn't get its own tail cut
// more aggressively than one with a sharp peak. 50 was picked by looking
// at the real data: it cleanly separates the meaningful 10-65 minute range
// from one-off games at 70+ minutes whose win rate is just noise (a single
// game is either 0% or 100%).
const DURATION_MIN_GAMES = 50

function DurationSection({ durations }: { durations: { duration_bin: number; games_played: number; wins: number }[] }) {
  const rows = useMemo(
    () =>
      [...durations]
        .filter((d) => d.games_played >= DURATION_MIN_GAMES)
        .sort((a, b) => a.duration_bin - b.duration_bin)
        .map((d) => ({ ...d, wr: (d.wins / d.games_played) * 100 })),
    [durations],
  )
  if (rows.length === 0) return null

  const minWr = Math.min(...rows.map((r) => r.wr))
  const maxWr = Math.max(...rows.map((r) => r.wr))
  const span = Math.max(1, maxWr - minWr)
  const BAR_MAX = 96
  const BAR_MIN = 18
  const heightFor = (wr: number) => BAR_MIN + ((wr - minWr) / span) * (BAR_MAX - BAR_MIN)

  return (
    <StatPanel title="Win Rate by Game Length">
      <div className="flex items-end justify-center gap-2 sm:gap-3 overflow-x-auto py-2">
        {rows.map((r) => (
          <div key={r.duration_bin} className="flex shrink-0 flex-col items-center" style={{ width: 48 }}>
            <div
              className="text-[14px] font-semibold tabular-nums mb-1"
              style={{ color: r.wr >= 52 ? '#8ec63f' : r.wr < 48 ? '#d14a38' : '#a8a294', fontFamily: 'var(--font-dota)' }}
            >
              {r.wr.toFixed(0)}%
            </div>
            <div
              className="w-full rounded-t-sm"
              style={{ height: heightFor(r.wr), background: r.wr >= 52 ? '#8ec63f' : r.wr < 48 ? '#d14a38' : '#c9a94a' }}
              title={`${r.games_played.toLocaleString()} games`}
            />
            <div className="mt-1.5 text-[13px]" style={{ color: '#7a7464', fontFamily: 'var(--font-dota)' }}>
              {Math.round(r.duration_bin / 60)}m
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-[13px] mt-1" style={{ color: '#7a7464' }}>
        Minimum {DURATION_MIN_GAMES} games in that duration bucket.
      </div>
    </StatPanel>
  )
}

const ITEM_PHASES: { key: 'start_game_items' | 'early_game_items' | 'mid_game_items' | 'late_game_items'; label: string }[] = [
  { key: 'start_game_items', label: 'Starting' },
  { key: 'early_game_items', label: 'Early Game' },
  { key: 'mid_game_items', label: 'Mid Game' },
  { key: 'late_game_items', label: 'Late Game' },
]

// Most-purchased items per game phase. OpenDota's itemPopularity endpoint
// gives purchase counts only, not a per-item win rate for this breakdown,
// so this reads as "what's commonly bought", not "what wins".
function ItemPopularitySection({
  popularity,
  idToName,
}: {
  popularity: {
    start_game_items: Record<string, number>
    early_game_items: Record<string, number>
    mid_game_items: Record<string, number>
    late_game_items: Record<string, number>
  }
  idToName: Map<number, string>
}) {
  return (
    <StatPanel title="Popular Items">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ITEM_PHASES.map((phase) => {
          const counts = popularity[phase.key] ?? {}
          const top = Object.entries(counts)
            .map(([id, count]) => ({ id: Number(id), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
          if (top.length === 0) return null
          const maxCount = Math.max(1, ...top.map((t) => t.count))
          return (
            <div key={phase.key}>
              <div className="text-[13px] font-bold uppercase tracking-widest mb-2" style={{ color: '#a8a294' }}>
                {phase.label}
              </div>
              {top.map((t) => {
                const name = idToName.get(t.id)
                return (
                  <div key={t.id} className="flex items-center gap-2 py-1">
                    {name && (
                      <img
                        src={itemIconUrl(name)}
                        alt=""
                        data-item-name={name}
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.src.includes(ITEM_CDN_FALLBACK)) img.src = `${ITEM_CDN_FALLBACK}/${name}.png`
                        }}
                        className="h-7 w-11 shrink-0 rounded-sm object-cover"
                      />
                    )}
                    <div className="h-[4px] flex-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ width: `${(t.count / maxCount) * 100}%`, height: '100%', background: '#c9a94a' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </StatPanel>
  )
}

function HeroDetailPage() {
  const { heroName } = Route.useParams()
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const heroAbilities = useQuery({
    queryKey: ['hero_abilities'],
    queryFn: () => opendota.heroAbilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const abilities = useQuery({
    queryKey: ['abilities_constants'],
    queryFn: () => opendota.abilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const heroLore = useQuery({
    queryKey: ['hero_lore'],
    queryFn: () => opendota.heroLore(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const aghsDesc = useQuery({
    queryKey: ['aghs_desc'],
    queryFn: () => opendota.aghsDesc(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const items = useQuery({
    queryKey: ['items_constants'],
    queryFn: () => opendota.items(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const hero = heroStats.data?.find(
    (h) =>
      h.name === `npc_dota_hero_${heroName}` ||
      heroSlug(h.localized_name) === heroName.toLowerCase(),
  )
  usePageTitle(hero?.localized_name)

  const heroMap = useMemo(
    () => new Map((heroStats.data ?? []).map((h) => [h.id, { localized_name: h.localized_name, name: h.name }])),
    [heroStats.data],
  )
  const itemIdToName = useMemo(
    () => new Map(Object.entries(items.data ?? {}).map(([name, v]) => [v.id, name])),
    [items.data],
  )

  // Live tagline / complexity / exact stats from Valve's datafeed (via /df proxy).
  const heroData = useQuery({
    queryKey: ['hero_datafeed', hero?.id],
    queryFn: () => datafeed.heroData(hero!.id),
    enabled: !!hero?.id,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const matchups = useQuery({
    queryKey: ['hero_matchups', hero?.id],
    queryFn: () => opendota.heroMatchups(String(hero!.id)),
    enabled: !!hero?.id,
    staleTime: 60 * 60 * 1000,
  })
  const durations = useQuery({
    queryKey: ['hero_durations', hero?.id],
    queryFn: () => opendota.heroDurations(String(hero!.id)),
    enabled: !!hero?.id,
    staleTime: 60 * 60 * 1000,
  })
  const itemPopularity = useQuery({
    queryKey: ['hero_item_popularity', hero?.id],
    queryFn: () => opendota.heroItemPopularity(String(hero!.id)),
    enabled: !!hero?.id,
    staleTime: 60 * 60 * 1000,
  })
  // Whether the header's lore is expanded to its full history inline.
  const [loreOpen, setLoreOpen] = useState(false)
  const [selectedAbilityIdx, setSelectedAbilityIdx] = useState(0)
  const abilityDetailRef = useRef<HTMLDivElement>(null)

  function selectAbilityOnBanner(name: string) {
    const idx = abilityList.indexOf(name)
    if (idx >= 0) {
      setSelectedAbilityIdx(idx)
      abilityDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!hero) return <div className="text-sm text-muted">Hero not found.</div>

  const short = hero.name.replace('npc_dota_hero_', '')
  const attr = ATTR[hero.primary_attr] ?? { label: hero.primary_attr, color: '#888' }
  // Abilities & talents
  const ha = heroAbilities.data?.[hero.name]
  const lore = heroLore.data?.[short]
  const aghs = aghsDesc.data?.find((x) => x.hero_name === hero.name)
  // Ability names that are NEW skills granted by scepter or shard (not modifications of existing abilities).
  // Identified by matching the aghs skill display name against ability dnames.
  const aghsNewSkills = (() => {
    const s = new Set<string>()
    if (!aghs || !abilities.data) return s
    for (const a of ha?.abilities ?? []) {
      if (!a) continue
      const dname = abilities.data[a]?.dname
      if (aghs.has_scepter && aghs.scepter_new_skill && dname === aghs.scepter_skill_name) s.add(a)
      if (aghs.has_shard && aghs.shard_new_skill && dname === aghs.shard_skill_name) s.add(a)
    }
    return s
  })()
  const abilityList = (ha?.abilities ?? []).filter((a) => {
    if (!a || a === 'generic_hidden' || a.startsWith('special_') || aghsNewSkills.has(a)) return false
    const ab = abilities.data?.[a]
    if (ab?.is_innate) return false
    const beh = ab?.behavior
    const isHidden = Array.isArray(beh)
      ? beh.some((s) => String(s).includes('Hidden'))
      : String(beh ?? '').includes('Hidden')
    return !isHidden
  })
  // Only true innates get the circular icon. Hidden non-innate abilities are
  // toggle sub-states of other skills (e.g. Techies' Detonate Tazer) — skip.
  const innateList = (ha?.abilities ?? []).filter((a) => {
    if (!a || a === 'generic_hidden' || a.startsWith('special_') || aghsNewSkills.has(a)) return false
    return abilities.data?.[a]?.is_innate === true
  })
  const meta = heroData.data
  // dota2.com shows the short hype blurb by default and the full bio behind "Read Full History".
  const shortHistory = meta?.hype || meta?.bio || lore || ''
  const fullHistory = meta?.bio || lore || ''
  const history = loreOpen ? fullHistory : shortHistory
  const talents = ha?.talents ?? []
  const talentTiers = [4, 3, 2, 1].map((lvl) => ({
    lvl: [0, 10, 15, 20, 25][lvl],
    pair: talents.filter((t) => t.level === lvl),
  }))
  // Talent rows for the hover tooltip, highest tier first. Prefer Valve's
  // datafeed strings (placeholders resolved, [10R,10L,15R,15L,...] order);
  // fall back to OpenDota dnames for heroes the datafeed hasn't loaded yet.
  const talentRows: { lvl: number; left: string; right: string }[] =
    meta?.talents && meta.talents.length >= 8
      ? [3, 2, 1, 0].map((i) => ({
          lvl: [10, 15, 20, 25][i],
          left: meta.talents?.[2 * i + 1]?.label ?? '',
          right: meta.talents?.[2 * i]?.label ?? '',
        }))
      : talentTiers
          .map(({ lvl, pair }) => ({
            lvl,
            left: abilities.data?.[pair[0]?.name ?? '']?.dname ?? '',
            right: abilities.data?.[pair[1]?.name ?? '']?.dname ?? '',
          }))
          .filter((r) => r.left || r.right)
  // Prev / next hero (alphabetical), used by the top-right nav and the footer.
  const sortedHeroes = [...(heroStats.data ?? [])].sort((a, b) =>
    a.localized_name.localeCompare(b.localized_name),
  )
  const heroIdx = sortedHeroes.findIndex((h) => h.name === hero.name)
  // Wraps around like dota2.com (Abaddon's previous hero is Zeus).
  const prevHero = sortedHeroes[(heroIdx - 1 + sortedHeroes.length) % sortedHeroes.length]
  const nextHero = sortedHeroes[(heroIdx + 1) % sortedHeroes.length]
  // dota2.com shows attack damage including the primary-attribute bonus (universal: 45% of all).
  const attrBonus = meta
    ? hero.primary_attr === 'str'
      ? meta.str_base
      : hero.primary_attr === 'agi'
        ? meta.agi_base
        : hero.primary_attr === 'int'
          ? meta.int_base
          : Math.floor(0.45 * (meta.str_base + meta.agi_base + meta.int_base))
    : 0

  return (
    <div className="space-y-4">
      {/* Hero header — dota2.com layout: text column top-left, animated render bleeding right */}
      <div
        className="relative overflow-hidden -mx-6 -mt-[calc(2rem+5rem)]"
        style={{
          minHeight: 780,
          background: '#000 url(/backgrounds/greyfade.jpg) no-repeat top center / 100%',
        }}
      >
        {/* diagonal darker band across the backdrop, same skew matrix as dota2.com */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 40,
            left: 140,
            width: 2700,
            height: 650,
            background: 'rgba(0,0,0,0.376)',
            transform: 'matrix(1, -1, 0, 1, -900, 900)',
          }}
        />
        {/* the animated, transparent hero render — dota2.com layout: a 75%-wide,
            banner-height flex box that centers the square clip, with per-hero
            placement tweaks ported from their CSS */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ width: '75%', height: '100%', top: 0, right: '5%', ...RENDER_TWEAKS[short] }}
        >
          <video
            key={short}
            autoPlay
            loop
            muted
            playsInline
            poster={heroRenderPoster(short)}
            style={{ width: '100%', maxWidth: 1350, aspectRatio: '1 / 1', objectFit: 'contain' }}
          >
            <source type="video/webm" src={`${RENDER}/${short}.webm`} />
            <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${short}.mov`} />
          </video>
        </div>
        {/* bottom fade into the stat bar, same gradient dota2.com uses */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.733) 75%, rgb(0,0,0) 100%)',
          }}
        />
        {/* left rail: vertical hero name + id + attribute icon */}
        <div
          className="absolute z-[3] hidden lg:flex flex-col items-center"
          style={{ left: 50, top: 0, bottom: 70, width: 50 }}
        >
          <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.25)' }} />
          <div
            className="uppercase"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              color: '#fff',
              fontSize: 16,
              letterSpacing: '4px',
              margin: '18px 0 4px',
              fontFamily: 'var(--font-dota)',
            }}
          >
            {hero.localized_name}
          </div>
          <div
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              letterSpacing: '2px',
              marginBottom: 16,
            }}
          >
            {hero.id}
          </div>
          <img src={attrIconUrl(hero.primary_attr)} alt="" style={{ width: 28, height: 28 }} />
        </div>
        {/* top-right prev / all / next navigation */}
        <div className="absolute z-[4] flex items-center gap-2" style={{ top: 160, right: 30 }}>
          {prevHero && (
            <a
              href={`/hero/${heroSlug(prevHero.localized_name)}`}
              title={prevHero.localized_name}
              className="flex items-center justify-center hover:bg-white/10"
              style={{
                width: 40,
                height: 40,
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ‹
            </a>
          )}
          <a
            href="/heroes"
            title="All Heroes"
            className="grid grid-cols-3 place-items-center hover:bg-white/10"
            style={{
              width: 56,
              height: 56,
              border: '1px solid rgba(255,255,255,0.5)',
              padding: 10,
              gap: 3,
            }}
          >
            {[...Array(6)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
              <span key={i} style={{ width: 9, height: 9, background: '#fff', display: 'block' }} />
            ))}
          </a>
          {nextHero && (
            <a
              href={`/hero/${heroSlug(nextHero.localized_name)}`}
              title={nextHero.localized_name}
              className="flex items-center justify-center hover:bg-white/10"
              style={{
                width: 40,
                height: 40,
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ›
            </a>
          )}
        </div>
        {/* text column, in normal flow so the banner grows when the lore expands.
            Left inset (~9% of the banner) matches dota2.com's content gutter. */}
        <div className="relative z-10 pl-[9.4%] pr-6 pt-[calc(5rem+3.75rem)] pb-24 max-w-[740px]">
          <div className="flex items-center mb-0.5">
            <img
              src={attrIconUrl(hero.primary_attr)}
              alt=""
              className="h-[32px] w-[32px] shrink-0"
            />
            <span
              className="ml-1.5 text-[24px] uppercase"
              style={{
                color: '#fff',
                fontWeight: 100,
                letterSpacing: '2px',
                fontFamily: 'var(--font-dota)',
              }}
            >
              {attr.label}
            </span>
          </div>
          <h1
            className="text-[80px] font-bold uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#fff',
              lineHeight: '88px',
              letterSpacing: '2px',
              marginTop: 12,
            }}
          >
            {hero.localized_name}
          </h1>
          {meta?.tagline && (
            <div
              className="mt-2 text-[18px] font-bold uppercase"
              style={{
                color: '#a5e0f3',
                fontFamily: 'var(--font-dota)',
                letterSpacing: '2px',
                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              }}
            >
              {meta.tagline}
            </div>
          )}
          {history && (
            <>
              <p
                className="text-[24px]"
                style={{
                  color: '#eeeeee',
                  fontFamily: 'var(--font-dota)',
                  fontWeight: 200,
                  lineHeight: 1.5,
                  marginTop: 14,
                  textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)',
                }}
              >
                <HistoryText text={history} />
              </p>
              {fullHistory && fullHistory !== shortHistory && (
                <button
                  type="button"
                  onClick={() => setLoreOpen((v) => !v)}
                  className="inline-block mt-2 text-[18px] underline cursor-pointer hover:text-white"
                  style={{
                    color: '#8a8a8a',
                    fontWeight: 200,
                    fontFamily: 'var(--font-dota)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 2px 10px rgba(0,0,0,0.7)',
                  }}
                >
                  {loreOpen ? 'Close History' : 'Read Full History'}
                </button>
              )}
            </>
          )}
          <div
            className="text-[17px] font-bold uppercase"
            style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px', marginTop: 30 }}
          >
            Attack Type
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <img
              src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/${hero.attack_type.toLowerCase()}.svg`}
              alt=""
              style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }}
            />
            <span
              className="text-[15px] font-bold uppercase"
              style={{ color: '#fff', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
            >
              {hero.attack_type}
            </span>
          </div>
          {meta && (
            <>
              <div
                className="text-[17px] font-bold uppercase"
                style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px', marginTop: 30 }}
              >
                Complexity
              </div>
              <div className="flex" style={{ gap: 12, marginTop: 8, marginLeft: 4 }}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    style={{
                      width: 15,
                      height: 15,
                      display: 'block',
                      transform: 'rotate(45deg)',
                      border: '1px solid #fff',
                      background: n <= meta.complexity ? '#fff' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {/* ABILITIES — anchored bottom-center-right of the banner, matching dota2.com layout.
            Innate (hidden-behavior) abilities shown as circular icons first, regular as square. */}
        {(abilityList.length > 0 || innateList.length > 0) && abilities.data && (
          <div
            className="absolute z-[2] flex flex-col items-start"
            style={{ bottom: 40, right: 'min(140px, 7.8vw)' }}
          >
            <div
              className="text-[18px] font-bold uppercase mb-1.5"
              style={{ color: '#ffffff', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
            >
              Abilities
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {talents.length > 0 && abilities.data && (
                <div className="relative group shrink-0" style={{ width: 72, height: 72 }}>
                  <img
                    src={TALENTS_ICON_CDN}
                    alt="Talents"
                    style={{ width: 72, height: 72, cursor: 'default' }}
                  />
                  {/* Talent tree tooltip on hover, styled like dota2.com */}
                  <div
                    className="absolute bottom-full mb-2 hidden group-hover:block z-50 pointer-events-none"
                    style={{
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 500,
                      background: 'linear-gradient(150deg, rgb(104,114,124), rgb(20,23,26))',
                      padding: '16px 16px 28px',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
                    }}
                  >
                    <div
                      className="text-center uppercase"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: '2px',
                        color: '#fff',
                        marginBottom: 12,
                      }}
                    >
                      Talent Tree
                    </div>
                    {talentRows.map(({ lvl, left, right }) => (
                      <div
                        key={lvl}
                        className="flex items-center"
                        style={{ height: 50, background: 'rgba(0,0,0,0.5)', marginBottom: 4, padding: '0 14px' }}
                      >
                        <div
                          className="flex-1 text-center"
                          style={{ fontSize: 13, lineHeight: 1.25, color: 'rgba(255,255,255,0.73)', fontFamily: 'var(--font-dota)' }}
                        >
                          {left}
                        </div>
                        <div
                          className="shrink-0 flex items-center justify-center rounded-full"
                          style={{
                            width: 38,
                            height: 38,
                            margin: '0 12px',
                            background: '#222',
                            border: '2px solid #85601f',
                            color: '#e7d292',
                            fontFamily: 'var(--font-display)',
                            fontSize: 20,
                            fontWeight: 700,
                            textShadow: '0 0 8px rgb(255,83,28)',
                          }}
                        >
                          {lvl}
                        </div>
                        <div
                          className="flex-1 text-center"
                          style={{ fontSize: 13, lineHeight: 1.25, color: 'rgba(255,255,255,0.73)', fontFamily: 'var(--font-dota)' }}
                        >
                          {right}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {innateList.map((name) => {
                const ab = abilities.data?.[name]
                const abilityDesc =
                  ab?.desc ||
                  meta?.abilityDescs?.[name] ||
                  (ab?.dname ? meta?.abilityDescs?.[ab.dname.toLowerCase()] : undefined)
                const beh = Array.isArray(ab?.behavior)
                  ? (ab.behavior as string[]).filter((b) => b !== 'Hidden').join(' / ')
                  : ab?.behavior ? String(ab.behavior) : null
                const attribs = (ab?.attrib ?? []).filter(
                  (x) => x.header && x.value != null && x.value !== '' && !x.generated,
                )
                return (
                  <div key={name} className="relative group shrink-0">
                    <img
                      src={INNATE_ICON_CDN}
                      alt={ab?.dname ?? name}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.25)',
                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
                        cursor: 'default',
                      }}
                    />
                    <div
                      className="absolute bottom-full mb-2 hidden group-hover:block z-50 pointer-events-none"
                      style={{
                        left: '50%',
                        transform: 'translateX(-20%)',
                        width: 280,
                        background: 'rgba(10,9,12,0.97)',
                        border: '1px solid #24222a',
                        padding: '10px 14px',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src={abilityIconUrl(name)}
                          alt=""
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.2)',
                            flexShrink: 0,
                            objectFit: 'cover',
                          }}
                          onError={(ev) => {
                            const el = ev.currentTarget
                            const step = el.dataset.step ?? '0'
                            if (step === '0') {
                              el.dataset.step = '1'
                              el.src = abilityIconCdn(name, abilities.data?.[name]?.img)
                            } else {
                              el.dataset.step = '2'
                              el.src = INNATE_ICON_CDN
                            }
                          }}
                        />
                        <div>
                          <div
                            style={{
                              color: '#fff',
                              fontFamily: 'var(--font-display)',
                              fontSize: 14,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                            }}
                          >
                            {ab?.dname ?? name}
                          </div>
                          {abilityDesc && (
                            <div
                              style={{
                                color: '#c8c2b4',
                                fontFamily: 'var(--font-dota)',
                                fontSize: 11,
                                lineHeight: 1.4,
                                marginTop: 3,
                              }}
                            >
                              {abilityDesc}
                            </div>
                          )}
                        </div>
                      </div>
                      {beh && (
                        <div
                          style={{
                            color: '#6a675e',
                            fontFamily: 'var(--font-dota)',
                            fontSize: 11,
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            marginBottom: attribs.length > 0 ? 6 : 0,
                          }}
                        >
                          {beh}
                        </div>
                      )}
                      {attribs.map((x, i) => (
                        <div
                          key={i}
                          className="flex justify-between"
                          style={{ borderTop: '1px solid #1e1a12', paddingTop: 4, paddingBottom: 4 }}
                        >
                          <span
                            style={{
                              color: '#6a675e',
                              fontFamily: 'var(--font-dota)',
                              fontSize: 11,
                              textTransform: 'uppercase',
                            }}
                          >
                            {x.header}
                          </span>
                          <span
                            style={{
                              color: '#c8c2b4',
                              fontFamily: 'var(--font-dota)',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {Array.isArray(x.value) ? (x.value as (string | number)[]).join(' / ') : String(x.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {abilityList.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={abilities.data?.[name]?.dname ?? name}
                  onClick={() => selectAbilityOnBanner(name)}
                  className="rounded-sm p-0 shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <img
                    src={abilityIconUrl(name)}
                    alt={abilities.data?.[name]?.dname ?? name}
                    className="rounded-sm block"
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.15)',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
                    }}
                    onError={(ev) => {
                      const el = ev.currentTarget
                      const step = el.dataset.step ?? '0'
                      if (step === '0') {
                        el.dataset.step = '1'
                        el.src = abilityIconCdn(name, abilities.data?.[name]?.img)
                      } else {
                        el.style.display = 'none'
                      }
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header stat bar — portrait, attributes, roles and Attack/Defense/Mobility (dota2.com layout).
          Sections are flex-col with justify-between so their labels share the same baseline. */}
      <div
        className="-mx-6 -mt-4 pl-[4.3%] pr-[4.3%] pt-5 pb-4 flex gap-x-9 gap-y-4"
        style={{
          background: 'linear-gradient(80deg, rgb(37,39,40) 0%, rgb(16,20,21) 100%)',
          borderTop: '2px solid rgb(40,40,40)',
          borderBottom: '2px solid rgb(44,46,46)',
          boxShadow: 'rgb(0,0,0) 0px 0px 8px',
          minHeight: 221,
        }}
      >
        {/* ATTRIBUTES: portrait + attr rows + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-center gap-4">
            <div className="flex flex-col gap-1.5" style={{ width: 150 }}>
              <img
                src={heroLandscapeCdn(hero.name)}
                alt={hero.localized_name}
                className="w-full rounded-sm"
                style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
              />
              {meta && (
                <>
                  <TotalBar fill="#5c8a2c" value={meta.max_health} gain={meta.health_regen} />
                  <TotalBar fill="#2f74c0" value={meta.max_mana} gain={meta.mana_regen} />
                </>
              )}
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <AttrRow
                attrKey="str"
                base={meta?.str_base ?? hero.base_str}
                gain={meta?.str_gain ?? hero.str_gain}
              />
              <AttrRow
                attrKey="agi"
                base={meta?.agi_base ?? hero.base_agi}
                gain={meta?.agi_gain ?? hero.agi_gain}
              />
              <AttrRow
                attrKey="int"
                base={meta?.int_base ?? hero.base_int}
                gain={meta?.int_gain ?? hero.int_gain}
              />
            </div>
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Attributes
          </span>
        </div>

        {/* ROLES: level-scaled bars + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
            {ALL_ROLES.map((r, i) => {
              const level = meta?.role_levels?.[i] ?? (hero.roles.includes(r) ? 3 : 0)
              const active = level > 0
              return (
                <div key={r} className="flex flex-col gap-1.5">
                  <span
                    className="text-[15px] font-bold"
                    style={{
                      color: active ? '#ffffff' : '#5c584e',
                      letterSpacing: '1px',
                      fontFamily: 'var(--font-dota)',
                    }}
                  >
                    {r}
                  </span>
                  <span className="relative h-[3px] rounded-full" style={{ background: '#3a3a3e' }}>
                    {active && (
                      <span
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${(level / 3) * 100}%`,
                          background: '#f2f4f8',
                          boxShadow: '0 0 5px 1px rgba(120,170,235,0.7)',
                        }}
                      />
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Roles
          </span>
        </div>

        {/* STATS: Attack / Defense / Mobility + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex flex-wrap items-start justify-center gap-x-10 gap-y-4">
            <StatGroup title="Attack">
              <IconStat
                icon="damage"
                value={
                  meta
                    ? `${meta.damage_min + attrBonus}-${meta.damage_max + attrBonus}`
                    : `${hero.base_attack_min}-${hero.base_attack_max}`
                }
              />
              <IconStat icon="attack_time" value={meta ? String(+meta.attack_rate.toFixed(2)) : '1.7'} />
              <IconStat icon="attack_range" value={String(meta?.attack_range ?? hero.attack_range)} />
              {meta && <IconStat icon="projectile_speed" value={meta.projectile_speed} />}
            </StatGroup>

            <StatGroup title="Defense">
              <IconStat icon="armor" value={(meta?.armor ?? hero.base_armor).toFixed(1)} />
              {meta && <IconStat icon="magic_resist" value={`${meta.magic_resistance}%`} />}
            </StatGroup>

            <StatGroup title="Mobility">
              <IconStat
                icon="movement_speed"
                value={String(meta?.movement_speed ?? hero.move_speed)}
              />
              {meta && <IconStat icon="turn_rate" value={meta.turn_rate.toFixed(1)} />}
              {meta && (
                <IconStat
                  icon="vision"
                  value={`${meta.sight_range_day} / ${meta.sight_range_night}`}
                />
              )}
            </StatGroup>
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Stats
          </span>
        </div>
      </div>

      {/* Ability Details */}
      {abilityList.length > 0 && abilities.data && (
        <div
          ref={abilityDetailRef}
          style={{
            color: '#fff',
            boxSizing: 'border-box',
            fontFamily: 'Radiance, "Noto Sans", sans-serif',
            width: '100%',
            minHeight: 400,
            padding: '80px 0',
            marginTop: -10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            className="text-center pb-6 uppercase"
            style={{
              color: '#ffffff',
              fontFamily: 'var(--font-dota)',
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '3px',
            }}
          >
            Ability Details:
          </div>
          <div style={{ width: '100%' }}>
            <AbilityDetails
              heroShort={short}
              abilityList={abilityList}
              abilities={abilities.data}
              aghs={aghs}
              innateNames={innateList}
              hasTalents={talents.length > 0}
              aghsNewSkillNames={[...aghsNewSkills]}
              selectedIdx={selectedAbilityIdx}
              onSelectIdx={setSelectedAbilityIdx}
            />
          </div>
        </div>
      )}

      {/* Meta stats: matchups, win rate by game length, popular item builds.
          Capped at the same width as the header's text column (max-w-[740px]
          above) rather than the page's usual full-bleed width, tables and
          charts read better at that narrower measure than stretched wide. */}
      {hero && (
        <div className="max-w-[1040px] mx-auto space-y-6">
          {matchups.data && <MatchupsSection heroMap={heroMap} matchups={matchups.data} />}
          {durations.data && <DurationSection durations={durations.data} />}
          {itemPopularity.data && <ItemPopularitySection popularity={itemPopularity.data} idToName={itemIdToName} />}
        </div>
      )}

      {/* Hero navigation footer — 150px bar, hero busts rise above it like dota2.com */}
      {(() => {
        const IMG = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react'
        const cropUrl = (n: string) => `${IMG}/heroes/crops/${n.replace('npc_dota_hero_', '')}.png`
        const ATTR_ICON: Record<string, string> = { str: 'hero_strength', agi: 'hero_agility', int: 'hero_intelligence', all: 'hero_universal' }
        const attrIcon = (attr: string) => `${IMG}/icons/${ATTR_ICON[attr] ?? 'hero_universal'}.png`
        const BG = `url("${IMG}/backgrounds/grey_painterly_wide.png")`
        const linkBase: React.CSSProperties = {
          position: 'relative', display: 'flex', alignItems: 'center', height: '100%',
          width: '45%', backgroundImage: BG, backgroundSize: 'cover', backgroundPosition: 'center',
          textDecoration: 'none', color: '#fff', padding: '0 30px',
          transition: 'filter 0.15s',
        }
        const nameStyle: React.CSSProperties = {
          fontSize: 28, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
          letterSpacing: '1px', fontFamily: 'var(--font-display)',
        }
        const labelStyle: React.CSSProperties = {
          fontSize: 15, color: '#9f9f9f', textTransform: 'uppercase',
          letterSpacing: '2px', marginBottom: 5,
        }
        const cropStyle: React.CSSProperties = {
          position: 'absolute', bottom: -20, width: 400, height: 250, maxWidth: '90%',
          objectFit: 'contain', pointerEvents: 'none',
        }
        return (
          <div
            className="-mx-6"
            style={{
              fontFamily: 'Radiance, "Noto Sans", sans-serif',
              color: '#fff', boxSizing: 'border-box',
              width: 'calc(100% + 3rem)', height: 150,
              backgroundColor: '#111',
              marginTop: 40,
              display: 'flex', flexDirection: 'row', alignItems: 'center',
            }}
          >
            {prevHero ? (
              <a
                href={`/hero/${heroSlug(prevHero.localized_name)}`}
                className="hover:brightness-125"
                style={{ ...linkBase, justifyContent: 'flex-end' }}
              >
                <img src={cropUrl(prevHero.name)} alt={prevHero.localized_name} style={{ ...cropStyle, left: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={labelStyle}>Previous Hero</div>
                  <div style={nameStyle}>{prevHero.localized_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <img src={attrIcon(prevHero.primary_attr)} alt="" style={{ width: 24, height: 24 }} />
                    <div style={{ fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {prevHero.attack_type}
                    </div>
                  </div>
                </div>
              </a>
            ) : <div style={{ width: '45%' }} />}

            <a
              href="/heroes"
              className="hover:bg-white/10"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flex: 1, height: '100%', textDecoration: 'none', color: '#fff', gap: 10 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 14px)', gap: 5 }}>
                {[...Array(6)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
                  <div key={i} style={{ width: 14, height: 14, background: 'rgba(255,255,255,0.85)' }} />
                ))}
              </div>
              <div style={{ fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase' }}>
                All Heroes
              </div>
            </a>

            {nextHero ? (
              <a
                href={`/hero/${heroSlug(nextHero.localized_name)}`}
                className="hover:brightness-125"
                style={{ ...linkBase, justifyContent: 'flex-start' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={labelStyle}>Next Hero</div>
                  <div style={nameStyle}>{nextHero.localized_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <img src={attrIcon(nextHero.primary_attr)} alt="" style={{ width: 24, height: 24 }} />
                    <div style={{ fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {nextHero.attack_type}
                    </div>
                  </div>
                </div>
                <img src={cropUrl(nextHero.name)} alt={nextHero.localized_name} style={{ ...cropStyle, right: 0 }} />
              </a>
            ) : <div style={{ width: '45%' }} />}
          </div>
        )
      })()}

    </div>
  )
}
