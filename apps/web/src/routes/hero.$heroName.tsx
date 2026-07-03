import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HeroStat } from 'types'
import { AbilityDetails } from '@/components/heroes/ability_details'
import { Spinner } from '@/components/ui/spinner'
import { datafeed } from '@/lib/datafeed'
import { opendota } from '@/lib/opendota'
import { heroBracketTotal, heroIconFromPath, heroLandscapeCdn, winRate } from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroName')({
  component: HeroDetailPage,
})

const BRACKET_LABELS = [
  '',
  'Herald',
  'Guardian',
  'Crusader',
  'Archon',
  'Legend',
  'Ancient',
  'Divine',
  'Immortal',
]

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

function cleanTalent(s: string): string {
  return s
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

type Matchup = { hero_id: number; games_played: number; wins: number }
type Duration = { duration_bin: number; games_played: number; wins: number }
type HeroMapVal = { name: string; shortName: string; localized_name: string; icon: string }

function MatchupTable({
  matchups,
  heroMap,
  title,
  sortDir,
}: {
  matchups: Matchup[]
  heroMap: Map<number, HeroMapVal>
  title: string
  sortDir: 'best' | 'worst'
}) {
  const withWr = matchups
    .filter((m) => m.games_played >= 20)
    .map((m) => ({ ...m, wr: m.wins / m.games_played }))
  const top = [...withWr]
    .sort((a, b) => (sortDir === 'best' ? b.wr - a.wr : a.wr - b.wr))
    .slice(0, 10)
  return (
    <div>
      <div
        className="text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}
      >
        {title}
      </div>
      {top.map((m) => {
        const h = heroMap.get(m.hero_id)
        if (!h) return null
        const wr = (m.wr * 100).toFixed(1)
        return (
          <a
            key={m.hero_id}
            href={`/hero/${h.shortName}`}
            className="flex items-center gap-2 py-1.5 hover:bg-white/[0.03]"
            style={{ borderTop: '1px solid #1c1810' }}
          >
            <img src={heroIconFromPath(h.icon)} alt="" className="h-6 w-6 rounded" />
            <span
              className="flex-1 text-[13px] truncate"
              style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
            >
              {h.localized_name}
            </span>
            <span className="text-[11px] tabular-nums" style={{ color: '#77715f' }}>
              {m.games_played.toLocaleString()}
            </span>
            <span
              className="w-12 text-right text-[12px] font-semibold tabular-nums"
              style={{
                color: sortDir === 'best' ? '#8ec63f' : '#d14a38',
                fontFamily: 'var(--font-dota)',
              }}
            >
              {wr}%
            </span>
          </a>
        )
      })}
    </div>
  )
}

function Panel({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      {title && (
        <div
          className="px-4 py-2.5 uppercase"
          style={{
            color: '#c8c2b4',
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: '3px',
            borderBottom: '1px solid #24222a',
          }}
        >
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
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

  const hero = heroStats.data?.find((h) => h.name === `npc_dota_hero_${heroName}`)

  const matchups = useQuery({
    queryKey: ['hero_matchups', hero?.id],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/heroes/${hero!.id}/matchups`).then((r) =>
        r.json(),
      ) as Promise<Matchup[]>,
    enabled: !!hero?.id,
  })
  const durations = useQuery({
    queryKey: ['hero_durations', hero?.id],
    queryFn: () =>
      fetch(`https://api.opendota.com/api/heroes/${hero!.id}/durations`).then((r) =>
        r.json(),
      ) as Promise<Duration[]>,
    enabled: !!hero?.id,
  })
  // Live tagline / complexity / exact stats from Valve's datafeed (via /df proxy).
  const heroData = useQuery({
    queryKey: ['hero_datafeed', hero?.id],
    queryFn: () => datafeed.heroData(hero!.id),
    enabled: !!hero?.id,
    staleTime: Number.POSITIVE_INFINITY,
  })
  // Whether the header's lore is expanded to its full history inline.
  const [loreOpen, setLoreOpen] = useState(false)

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
  const picks = heroBracketTotal(hero, 'pick')
  const wins = heroBracketTotal(hero, 'win')

  const heroMap = new Map<number, HeroMapVal>(
    (heroStats.data ?? []).map((h) => [
      h.id,
      {
        name: h.name,
        shortName: h.name.replace('npc_dota_hero_', ''),
        localized_name: h.localized_name,
        icon: h.icon,
      },
    ]),
  )

  const brackets = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    label: BRACKET_LABELS[i],
    picks: hero[`${i}_pick` as keyof HeroStat] as number,
    wins: hero[`${i}_win` as keyof HeroStat] as number,
  }))

  const durationData = (durations.data ?? [])
    .filter((d) => d.games_played >= 10)
    .sort((a, b) => a.duration_bin - b.duration_bin)
    .map((d) => ({
      min: Math.round(d.duration_bin / 60),
      wr: +((d.wins / d.games_played) * 100).toFixed(1),
      games: d.games_played,
    }))

  // Abilities & talents
  const ha = heroAbilities.data?.[hero.name]
  const abilityList = (ha?.abilities ?? []).filter(
    (a) =>
      a && a !== 'generic_hidden' && !a.startsWith('special_') && !abilities.data?.[a]?.is_innate,
  )
  const lore = heroLore.data?.[short]
  const aghs = aghsDesc.data?.find((x) => x.hero_name === hero.name)
  const meta = heroData.data
  const talents = ha?.talents ?? []
  const talentTiers = [4, 3, 2, 1].map((lvl) => ({
    lvl: [0, 10, 15, 20, 25][lvl],
    pair: talents.filter((t) => t.level === lvl),
  }))

  return (
    <div className="space-y-4">
      {/* Hero header — dota2.com layout: text column top-left, animated render bleeding right */}
      <div
        className="relative overflow-hidden rounded-t"
        style={{
          minHeight: 500,
          borderLeft: '1px solid #24222a',
          borderRight: '1px solid #24222a',
          borderTop: '1px solid #24222a',
          background: '#000',
          backgroundImage: 'url(/backgrounds/greyfade.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
        }}
      >
        {/* the actual animated, transparent hero render — fixed size, anchored top-right so it
            stays put when the lore expands and the banner grows taller */}
        <video
          key={short}
          autoPlay
          loop
          muted
          playsInline
          poster={heroRenderPoster(short)}
          className="absolute"
          style={{
            height: 920,
            aspectRatio: '1 / 1',
            top: -130,
            right: '-6%',
            objectFit: 'contain',
            objectPosition: 'center',
          }}
        >
          <source type="video/webm" src={`${RENDER}/${short}.webm`} />
          <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${short}.mov`} />
        </video>
        {/* left darkening to seat the text column, plus a soft bottom fade into the stat bar */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 34%, rgba(0,0,0,0.12) 56%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 22%)' }}
        />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: attr.color }} />

        {/* text column, in normal flow so the banner grows when the lore expands */}
        <div className="relative z-10 pl-8 pr-6 pt-7 pb-8 max-w-[600px]">
          <div className="flex items-center gap-2 mb-0.5">
            <img
              src={attrIconUrl(hero.primary_attr)}
              alt=""
              className="h-[22px] w-[22px] shrink-0"
            />
            <span
              className="text-[24px] uppercase"
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
              textShadow: '0 2px 20px rgba(0,0,0,0.95)',
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
          {lore && (
            <>
              <p
                className="mt-4 text-[15px] leading-relaxed"
                style={{
                  color: '#c4beb0',
                  fontFamily: 'var(--font-dota)',
                  fontWeight: 300,
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  ...(loreOpen
                    ? {}
                    : {
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }),
                }}
              >
                {lore}
              </p>
              <button
                type="button"
                onClick={() => setLoreOpen((v) => !v)}
                className="inline-block mt-1.5 text-[18px] cursor-pointer hover:text-white"
                style={{ color: '#8a8a8a', fontWeight: 200, fontFamily: 'var(--font-dota)' }}
              >
                {loreOpen ? 'Close History' : 'Read Full History'}
              </button>
            </>
          )}
          <div className="mt-6 flex items-start gap-12">
            <div>
              <div
                className="text-[17px] font-bold uppercase mb-1"
                style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
              >
                Attack Type
              </div>
              <div
                className="text-[15px] font-bold uppercase"
                style={{ color: '#fff', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
              >
                {hero.attack_type}
              </div>
            </div>
            {meta && (
              <div>
                <div
                  className="text-[17px] font-bold uppercase mb-1"
                  style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
                >
                  Complexity
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      style={{ color: n <= meta.complexity ? attr.color : '#3a3630', fontSize: 16 }}
                    >
                      ◆
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header stat bar — portrait, attributes, roles and Attack/Defense/Mobility (dota2.com layout) */}
      <div
        className="rounded-b px-6 py-5 flex flex-wrap items-start gap-x-9 gap-y-6"
        style={{
          background: 'rgba(8,8,10,0.85)',
          borderLeft: '1px solid #24222a',
          borderRight: '1px solid #24222a',
          borderBottom: '1px solid #24222a',
          borderTop: '1px solid #14130f',
        }}
      >
        {/* Portrait with health (green) and mana (blue) total bars, as on dota2.com */}
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

        {/* Attributes: icon + value + growth */}
        <div className="flex flex-col justify-center gap-0.5 self-center">
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

        {/* Roles: white, level-scaled bars over a grey track (no header, like dota2.com) */}
        <div className="self-center" style={{ width: 540 }}>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
            {ALL_ROLES.map((r, i) => {
              // Prefer Valve's 0..3 role emphasis; fall back to a full bar for any listed role.
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
        </div>

        {/* Attack / Defense / Mobility pushed to the far right, as on dota2.com */}
        <div className="ml-auto flex items-start gap-x-10">
          <StatGroup title="Attack">
            <IconStat
              icon="damage"
              value={
                meta
                  ? `${meta.damage_min}-${meta.damage_max}`
                  : `${hero.base_attack_min}-${hero.base_attack_max}`
              }
            />
            <IconStat icon="attack_time" value={meta ? meta.attack_rate.toFixed(2) : '1.70'} />
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
      </div>

      {/* Ability Details */}
      {abilityList.length > 0 && abilities.data && (
        <Panel title="Ability Details">
          <AbilityDetails
            heroShort={short}
            abilityList={abilityList}
            abilities={abilities.data}
            aghs={aghs}
          />
        </Panel>
      )}

      {/* Talents */}
      {talents.length > 0 && (
        <Panel title="Talents">
          <div className="space-y-1.5 max-w-2xl mx-auto">
            {talentTiers.map(
              ({ lvl, pair }) =>
                pair.length > 0 && (
                  <div key={lvl} className="flex items-center gap-2">
                    <div
                      className="flex-1 text-right text-[11px] px-2 py-1.5 rounded-sm"
                      style={{
                        background: '#14130f',
                        border: '1px solid #2a2620',
                        color: '#c8c2b4',
                        fontFamily: 'var(--font-dota)',
                      }}
                    >
                      {cleanTalent(abilities.data?.[pair[0]?.name ?? '']?.dname ?? '')}
                    </div>
                    <span
                      className="w-8 text-center text-[13px] font-bold shrink-0"
                      style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}
                    >
                      {lvl}
                    </span>
                    <div
                      className="flex-1 text-left text-[11px] px-2 py-1.5 rounded-sm"
                      style={{
                        background: '#14130f',
                        border: '1px solid #2a2620',
                        color: '#c8c2b4',
                        fontFamily: 'var(--font-dota)',
                      }}
                    >
                      {cleanTalent(abilities.data?.[pair[1]?.name ?? '']?.dname ?? '')}
                    </div>
                  </div>
                ),
            )}
          </div>
        </Panel>
      )}

      {/* Meta stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {(
          [
            [winRate(wins, picks), 'Win Rate'],
            [picks.toLocaleString(), 'Picks'],
            [hero.pro_pick.toLocaleString(), 'Pro Picks'],
            [hero.pro_ban.toLocaleString(), 'Pro Bans'],
            [winRate(hero.pro_win, hero.pro_pick), 'Pro Win%'],
          ] as [string, string][]
        ).map(([v, l]) => (
          <div
            key={l}
            className="px-3 py-3 rounded"
            style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}
          >
            <div
              className="text-[22px] font-bold leading-tight tabular-nums"
              style={{ color: '#ece6d8', fontFamily: 'var(--font-dota)' }}
            >
              {v}
            </div>
            <div
              className="text-[10px] uppercase tracking-widest mt-0.5"
              style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>

      {/* Win rate + matchups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Win Rate by Bracket">
          {brackets.map(({ label, picks: p, wins: w }) => {
            const wr = p > 0 ? (w / p) * 100 : 0
            return (
              <div
                key={label}
                className="flex items-center gap-3 py-1.5"
                style={{ borderTop: '1px solid #1c1810' }}
              >
                <span
                  className="w-20 text-[12px]"
                  style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
                >
                  {label}
                </span>
                <div
                  className="flex-1 h-1.5 rounded overflow-hidden"
                  style={{ background: '#14130f' }}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.min(wr, 100)}%`,
                      background: wr >= 50 ? '#8ec63f' : '#d14a38',
                    }}
                  />
                </div>
                <span
                  className="w-12 text-right text-[12px] tabular-nums font-semibold"
                  style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                >
                  {p > 0 ? `${wr.toFixed(1)}%` : '—'}
                </span>
              </div>
            )
          })}
        </Panel>

        <Panel title="Win Rate by Duration">
          {durationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={durationData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="wrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a94a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#c9a94a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="min"
                  tick={{ fill: '#77715f', fontSize: 10 }}
                  tickFormatter={(v) => `${v}m`}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[30, 70]}
                  tick={{ fill: '#77715f', fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#0b0a08',
                    border: '1px solid #3a352a',
                    fontFamily: 'var(--font-dota)',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#8a8474' }}
                  formatter={(v) => [`${v}%`, 'Win Rate']}
                  labelFormatter={(v) => `${v} min`}
                />
                <Area
                  type="monotone"
                  dataKey="wr"
                  stroke="#c9a94a"
                  strokeWidth={2}
                  fill="url(#wrGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm" style={{ color: '#6a675e' }}>
              No duration data.
            </p>
          )}
        </Panel>
      </div>

      {matchups.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="">
            <MatchupTable
              matchups={matchups.data}
              heroMap={heroMap}
              title="Strong Against"
              sortDir="best"
            />
          </Panel>
          <Panel title="">
            <MatchupTable
              matchups={matchups.data}
              heroMap={heroMap}
              title="Weak Against"
              sortDir="worst"
            />
          </Panel>
        </div>
      )}
    </div>
  )
}
