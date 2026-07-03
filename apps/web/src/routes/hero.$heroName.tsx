import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HeroStat } from 'types'
import { AbilityDetails } from '@/components/heroes/ability_details'
import { Spinner } from '@/components/ui/spinner'
import { datafeed } from '@/lib/datafeed'
import { opendota } from '@/lib/opendota'
import { heroBracketTotal, heroIconFromPath, winRate } from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroName')({
  component: HeroDetailPage,
})

const BRACKET_LABELS = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']

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

function cleanTalent(s: string): string {
  return s.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
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
  const withWr = matchups.filter((m) => m.games_played >= 20).map((m) => ({ ...m, wr: m.wins / m.games_played }))
  const top = [...withWr].sort((a, b) => (sortDir === 'best' ? b.wr - a.wr : a.wr - b.wr)).slice(0, 10)
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
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
            <span className="flex-1 text-[13px] truncate" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>{h.localized_name}</span>
            <span className="text-[11px] tabular-nums" style={{ color: '#77715f' }}>{m.games_played.toLocaleString()}</span>
            <span className="w-12 text-right text-[12px] font-semibold tabular-nums" style={{ color: sortDir === 'best' ? '#8ec63f' : '#d14a38', fontFamily: 'var(--font-dota)' }}>{wr}%</span>
          </a>
        )
      })}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      {title && (
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: '#77715f', fontFamily: 'var(--font-dota)', borderBottom: '1px solid #24222a' }}>
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest" style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}>{label}</span>
      <span className="text-[15px] font-extrabold tabular-nums leading-tight" style={{ color: color ?? '#ece6d8', fontFamily: 'var(--font-dota)' }}>{value}</span>
    </div>
  )
}

function HeroDetailPage() {
  const { heroName } = Route.useParams()
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const heroAbilities = useQuery({ queryKey: ['hero_abilities'], queryFn: () => opendota.heroAbilities(), staleTime: Number.POSITIVE_INFINITY })
  const abilities = useQuery({ queryKey: ['abilities_constants'], queryFn: () => opendota.abilities(), staleTime: Number.POSITIVE_INFINITY })
  const heroLore = useQuery({ queryKey: ['hero_lore'], queryFn: () => opendota.heroLore(), staleTime: Number.POSITIVE_INFINITY })
  const aghsDesc = useQuery({ queryKey: ['aghs_desc'], queryFn: () => opendota.aghsDesc(), staleTime: Number.POSITIVE_INFINITY })

  const hero = heroStats.data?.find((h) => h.name === `npc_dota_hero_${heroName}`)

  const matchups = useQuery({
    queryKey: ['hero_matchups', hero?.id],
    queryFn: () => fetch(`https://api.opendota.com/api/heroes/${hero!.id}/matchups`).then((r) => r.json()) as Promise<Matchup[]>,
    enabled: !!hero?.id,
  })
  const durations = useQuery({
    queryKey: ['hero_durations', hero?.id],
    queryFn: () => fetch(`https://api.opendota.com/api/heroes/${hero!.id}/durations`).then((r) => r.json()) as Promise<Duration[]>,
    enabled: !!hero?.id,
  })
  // Live tagline / complexity / exact stats from Valve's datafeed (via /df proxy).
  const heroData = useQuery({
    queryKey: ['hero_datafeed', hero?.id],
    queryFn: () => datafeed.heroData(hero!.id),
    enabled: !!hero?.id,
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (heroStats.isPending) {
    return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
  }
  if (!hero) return <div className="text-sm text-muted">Hero not found.</div>

  const short = hero.name.replace('npc_dota_hero_', '')
  const attr = ATTR[hero.primary_attr] ?? { label: hero.primary_attr, color: '#888' }
  const picks = heroBracketTotal(hero, 'pick')
  const wins = heroBracketTotal(hero, 'win')

  const heroMap = new Map<number, HeroMapVal>(
    (heroStats.data ?? []).map((h) => [h.id, { name: h.name, shortName: h.name.replace('npc_dota_hero_', ''), localized_name: h.localized_name, icon: h.icon }]),
  )

  const brackets = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    label: BRACKET_LABELS[i],
    picks: hero[`${i}_pick` as keyof HeroStat] as number,
    wins: hero[`${i}_win` as keyof HeroStat] as number,
  }))

  const durationData = (durations.data ?? [])
    .filter((d) => d.games_played >= 10)
    .sort((a, b) => a.duration_bin - b.duration_bin)
    .map((d) => ({ min: Math.round(d.duration_bin / 60), wr: +((d.wins / d.games_played) * 100).toFixed(1), games: d.games_played }))

  // Abilities & talents
  const ha = heroAbilities.data?.[hero.name]
  const abilityList = (ha?.abilities ?? []).filter(
    (a) => a && a !== 'generic_hidden' && !a.startsWith('special_') && !abilities.data?.[a]?.is_innate,
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
      {/* Hero banner — matching dota2.com: greyfade texture on black + animated render, text left */}
      <div
        className="relative overflow-hidden rounded"
        style={{
          height: 700,
          border: '1px solid #24222a',
          background: '#000',
          backgroundImage: 'url(/backgrounds/greyfade.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
        }}
      >
        {/* the actual animated, transparent hero render — large & bleeding, like dota2.com */}
        <video
          key={short}
          autoPlay
          loop
          muted
          playsInline
          poster={heroRenderPoster(short)}
          className="absolute"
          style={{ height: '136%', aspectRatio: '1 / 1', top: '-18%', right: '-7%', objectFit: 'contain', objectPosition: 'center' }}
        >
          <source type="video/webm" src={`${RENDER}/${short}.webm`} />
          <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${short}.mov`} />
        </video>
        {/* subtle left + bottom darkening for text legibility (as dota2.com does) */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 40%, transparent 62%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 40%)' }} />
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: attr.color }} />

        <div className="absolute left-8 bottom-8 right-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="text-[14px] font-bold uppercase tracking-[0.3em]" style={{ color: attr.color, fontFamily: 'var(--font-dota)' }}>
              {attr.label} · {hero.attack_type}
            </div>
            {meta && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#8a8578', fontFamily: 'var(--font-dota)' }}>Complexity</span>
                <span className="flex gap-0.5">
                  {[1, 2, 3].map((n) => (
                    <span key={n} style={{ color: n <= meta.complexity ? attr.color : '#3a3630', fontSize: 11 }}>◆</span>
                  ))}
                </span>
              </div>
            )}
          </div>
          <h1 className="text-[80px] leading-[0.9] font-bold uppercase" style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '2px', textShadow: '0 2px 20px rgba(0,0,0,0.95)' }}>
            {hero.localized_name}
          </h1>
          {meta?.tagline && (
            <div className="mt-2 text-[18px] font-bold max-w-xl" style={{ color: '#a5e0f3', fontFamily: 'var(--font-dota)', letterSpacing: '1px', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
              {meta.tagline}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {hero.roles.map((r) => (
              <span key={r} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm" style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid #3a3630', color: '#b8b2a4', fontFamily: 'var(--font-dota)' }}>
                {r}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Lore (right after the header, like dota2.com) */}
      {lore && (
        <Panel title="Lore">
          <p className="text-[14px] leading-relaxed max-w-4xl" style={{ color: '#b0aa9c', fontFamily: 'var(--font-dota)' }}>
            {lore}
          </p>
        </Panel>
      )}

      {/* Base attributes — exact displayed values from the datafeed */}
      <Panel title="Base Attributes">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatBox label="Strength" value={`${meta?.str_base ?? hero.base_str} +${(meta?.str_gain ?? hero.str_gain).toFixed(1)}`} color="#e24b3a" />
          <StatBox label="Agility" value={`${meta?.agi_base ?? hero.base_agi} +${(meta?.agi_gain ?? hero.agi_gain).toFixed(1)}`} color="#a2d240" />
          <StatBox label="Intelligence" value={`${meta?.int_base ?? hero.base_int} +${(meta?.int_gain ?? hero.int_gain).toFixed(1)}`} color="#4fb0e0" />
          <StatBox label="Health" value={meta ? `${meta.max_health} +${meta.health_regen.toFixed(1)}` : String(hero.base_health + hero.base_str * 22)} />
          <StatBox label="Mana" value={meta ? `${meta.max_mana} +${meta.mana_regen.toFixed(1)}` : String(hero.base_mana + hero.base_int * 12)} color="#4fb0e0" />
          <StatBox label="Damage" value={meta ? `${meta.damage_min}-${meta.damage_max}` : `${hero.base_attack_min}-${hero.base_attack_max}`} />
          <StatBox label="Armor" value={(meta?.armor ?? hero.base_armor).toFixed(1)} />
          <StatBox label="Magic Resist" value={meta ? `${meta.magic_resistance}%` : '—'} />
          <StatBox label="Attack Time" value={meta ? meta.attack_rate.toFixed(2) : '—'} />
          <StatBox label="Atk Range" value={String(meta?.attack_range ?? hero.attack_range)} />
          <StatBox label="Move Speed" value={String(meta?.movement_speed ?? hero.move_speed)} />
          <StatBox label="Vision" value={meta ? `${meta.sight_range_day} / ${meta.sight_range_night}` : '—'} />
        </div>
      </Panel>

      {/* Ability Details */}
      {abilityList.length > 0 && abilities.data && (
        <Panel title="Ability Details">
          <AbilityDetails heroShort={short} abilityList={abilityList} abilities={abilities.data} aghs={aghs} />
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
                    <div className="flex-1 text-right text-[11px] px-2 py-1.5 rounded-sm" style={{ background: '#14130f', border: '1px solid #2a2620', color: '#c8c2b4', fontFamily: 'var(--font-dota)' }}>
                      {cleanTalent(abilities.data?.[pair[0]?.name ?? '']?.dname ?? '')}
                    </div>
                    <span className="w-8 text-center text-[13px] font-bold shrink-0" style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}>{lvl}</span>
                    <div className="flex-1 text-left text-[11px] px-2 py-1.5 rounded-sm" style={{ background: '#14130f', border: '1px solid #2a2620', color: '#c8c2b4', fontFamily: 'var(--font-dota)' }}>
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
          <div key={l} className="px-3 py-3 rounded" style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
            <div className="text-[22px] font-bold leading-tight tabular-nums" style={{ color: '#ece6d8', fontFamily: 'var(--font-dota)' }}>{v}</div>
            <div className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Win rate + matchups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Win Rate by Bracket">
          {brackets.map(({ label, picks: p, wins: w }) => {
            const wr = p > 0 ? (w / p) * 100 : 0
            return (
              <div key={label} className="flex items-center gap-3 py-1.5" style={{ borderTop: '1px solid #1c1810' }}>
                <span className="w-20 text-[12px]" style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}>{label}</span>
                <div className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: '#14130f' }}>
                  <div className="h-full rounded" style={{ width: `${Math.min(wr, 100)}%`, background: wr >= 50 ? '#8ec63f' : '#d14a38' }} />
                </div>
                <span className="w-12 text-right text-[12px] tabular-nums font-semibold" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>{p > 0 ? `${wr.toFixed(1)}%` : '—'}</span>
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
                <XAxis dataKey="min" tick={{ fill: '#77715f', fontSize: 10 }} tickFormatter={(v) => `${v}m`} axisLine={false} tickLine={false} />
                <YAxis domain={[30, 70]} tick={{ fill: '#77715f', fontSize: 10 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0b0a08', border: '1px solid #3a352a', fontFamily: 'var(--font-dota)', fontSize: 12 }}
                  labelStyle={{ color: '#8a8474' }}
                  formatter={(v) => [`${v}%`, 'Win Rate']}
                  labelFormatter={(v) => `${v} min`}
                />
                <Area type="monotone" dataKey="wr" stroke="#c9a94a" strokeWidth={2} fill="url(#wrGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm" style={{ color: '#6a675e' }}>No duration data.</p>
          )}
        </Panel>
      </div>

      {matchups.data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="">
            <MatchupTable matchups={matchups.data} heroMap={heroMap} title="Strong Against" sortDir="best" />
          </Panel>
          <Panel title="">
            <MatchupTable matchups={matchups.data} heroMap={heroMap} title="Weak Against" sortDir="worst" />
          </Panel>
        </div>
      )}
    </div>
  )
}
