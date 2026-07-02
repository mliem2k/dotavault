import { type JSX, useState } from 'react'
import type { HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import { PlayerIdentityCell, ROW_H, TEAM_HEADER_H, orderedTeams, rankLabel } from './match_roster'

const IDENTITY_W = 236

type Abilities = Record<string, { dname?: string; img?: string }>
type AbilityIds = Record<string, string>

// Items counted in the "Support Items" column (wards, consumables, utility).
const SUPPORT_ITEMS = new Set([
  'ward_observer', 'ward_sentry', 'ward_dispenser', 'dust', 'smoke_of_deceit', 'tpscroll',
  'flask', 'clarity', 'tango', 'tango_single', 'enchanted_mango', 'faerie_fire', 'gem',
  'infused_raindrop', 'bottle', 'blood_grenade', 'cheese',
])

function abilityImg(name: string, abilities: Abilities): string | null {
  const img = abilities[name]?.img
  return img ? `https://cdn.cloudflare.steamstatic.com${img}` : null
}

/* Enemy heroes this player killed, aligned to the fixed enemy roster order. */
function HeroKillsGroup({
  player,
  enemies,
}: {
  player: MatchPlayer
  enemies: HeroStat[]
}) {
  const killCount = (heroName: string) =>
    (player.kills_log ?? []).filter((e) => e.key === heroName).length

  return (
    <div className="flex items-center gap-1 px-2 shrink-0">
      {enemies.map((h) => {
        const n = killCount(h.name)
        return (
          <div key={h.id} className="relative shrink-0" style={{ opacity: n > 0 ? 1 : 0.28 }}>
            <img
              src={heroIconUrl(h.name)}
              alt={h.localized_name}
              title={`${h.localized_name}: ${n}`}
              className="rounded"
              style={{ width: 30, height: 30, filter: n > 0 ? 'none' : 'grayscale(1)' }}
              onError={(e) => {
                const img = e.currentTarget
                img.onerror = null
                img.src = heroIconFromPath(h.icon)
              }}
            />
            {n > 0 && (
              <span
                className="absolute -bottom-1 -right-1 text-[9px] font-bold px-0.5 rounded-sm tabular-nums"
                style={{ background: '#0a0806', color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
              >
                {n}
              </span>
            )}
          </div>
        )
      })}
      <div className="w-9 text-center text-[14px] font-bold tabular-nums" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
        {player.kills}
      </div>
    </div>
  )
}

/* Support items purchased + total gold spent on them. */
function SupportItemsGroup({
  player,
  itemConst,
}: {
  player: MatchPlayer
  itemConst: Record<string, ItemConst>
}) {
  const counts = new Map<string, number>()
  for (const e of player.purchase_log ?? []) {
    if (SUPPORT_ITEMS.has(e.key)) counts.set(e.key, (counts.get(e.key) ?? 0) + 1)
  }
  const entries = [...counts.entries()]
  const gold = entries.reduce((s, [name, n]) => s + n * (itemConst[name]?.cost ?? 0), 0)

  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0" style={{ minWidth: 240 }}>
      <div className="flex items-center gap-1.5 flex-1">
        {entries.length === 0 ? (
          <span className="text-[11px]" style={{ color: '#3a352a', fontFamily: 'var(--font-dota)' }}>—</span>
        ) : (
          entries.map(([name, n]) => (
            <div key={name} className="relative shrink-0">
              <ItemIcon name={name} meta={itemConst[name]} width={30} height={22} />
              {n > 1 && (
                <span
                  className="absolute -bottom-1 -right-1 text-[9px] font-bold px-0.5 rounded-sm tabular-nums"
                  style={{ background: '#0a0806', color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                >
                  {n}
                </span>
              )}
            </div>
          ))
        )}
      </div>
      <span className="w-14 text-right text-[13px] font-semibold tabular-nums" style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}>
        {gold.toLocaleString()}
      </span>
    </div>
  )
}

/* Ability upgrade order (skill build). */
function AbilityBuildGroup({
  player,
  abilities,
  abilityIds,
}: {
  player: MatchPlayer
  abilities: Abilities
  abilityIds: AbilityIds
}) {
  const arr = player.ability_upgrades_arr ?? []
  return (
    <div className="flex items-center gap-[3px] px-2 shrink-0">
      {arr.map((id, i) => {
        const name = abilityIds[String(id)] ?? ''
        const isTalent = name.startsWith('special_bonus')
        const img = isTalent ? null : abilityImg(name, abilities)
        return (
          <div
            key={i}
            className="shrink-0 rounded-sm overflow-hidden flex items-center justify-center"
            style={{ width: 26, height: 26, background: isTalent ? '#1a2810' : '#12100c', border: `1px solid ${isTalent ? '#3a5a1a' : '#241f16'}` }}
            title={`Lvl ${i + 1}: ${abilities[name]?.dname ?? name}`}
          >
            {img ? (
              <img src={img} alt={name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.15' }} />
            ) : (
              <span className="text-[11px] font-bold" style={{ color: '#8ec63f' }}>▲</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

type SortKey =
  | 'kills' | 'deaths' | 'assists' | 'net_worth' | 'last_hits'
  | 'gold_per_min' | 'xp_per_min' | 'hero_damage' | 'hero_healing'

function fmtK(v: number): string {
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()
}

const GoldPip = () => (
  <svg width="11" height="11" viewBox="0 0 10 10" fill="none" className="inline-block shrink-0 -mt-0.5">
    <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
    <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">$</text>
  </svg>
)

type Col = {
  key: SortKey | null
  label: string | JSX.Element
  width: number
  color?: string
  render: (p: MatchPlayer) => JSX.Element
}

function ItemsCell({
  player,
  idToName,
  itemConst,
}: {
  player: MatchPlayer
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
}) {
  const items = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  return (
    <div className="flex gap-[3px]">
      {items.map((id, i) => {
        const name = id ? (idToName.get(id) ?? null) : null
        return (
          <ItemIcon key={i} name={name} meta={name ? itemConst[name] : undefined} width={33} height={25} />
        )
      })}
    </div>
  )
}

export function MatchScoreboard({
  match,
  heroStats,
  idToName,
  itemConst,
  abilities,
  abilityIds,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
  itemConst: Record<string, ItemConst>
  abilities: Abilities
  abilityIds: AbilityIds
}) {
  const [sortKey, setSortKey] = useState<SortKey>('net_worth')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else {
      setSortKey(key)
      setSortDir(key === 'deaths' ? 'asc' : 'desc')
    }
  }

  function sortPlayers(players: MatchPlayer[]): MatchPlayer[] {
    return [...players].sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[sortKey] ?? 0
      const bv = (b as unknown as Record<string, number>)[sortKey] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }

  const num = (color: string) => (v: number | string) => (
    <span className="text-[14px] tabular-nums" style={{ color, fontFamily: 'var(--font-dota)' }}>{v}</span>
  )

  const cols: Col[] = [
    { key: 'kills', label: 'K', width: 32, color: '#57c262', render: (p) => num('#57c262')(p.kills) },
    { key: 'deaths', label: 'D', width: 32, color: '#e84747', render: (p) => num('#e07a5a')(p.deaths) },
    { key: 'assists', label: 'A', width: 32, render: (p) => num('#c9b88a')(p.assists) },
    {
      key: 'net_worth',
      label: (<span className="inline-flex items-center gap-1"><GoldPip />NET</span>),
      width: 74,
      color: '#c9a94a',
      render: (p) => (
        <span className="text-[14px] font-semibold tabular-nums" style={{ color: '#d8bf6a', fontFamily: 'var(--font-dota)' }}>
          {p.net_worth.toLocaleString()}
        </span>
      ),
    },
    {
      key: null,
      label: 'Items',
      width: 6 * 33 + 5 * 3,
      render: (p) => <ItemsCell player={p} idToName={idToName} itemConst={itemConst} />,
    },
    {
      key: 'last_hits',
      label: 'LH / DN',
      width: 66,
      render: (p) => (
        <span className="text-[13px] tabular-nums" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>
          {p.last_hits}<span style={{ color: '#5a5446' }}> / </span>{p.denies}
        </span>
      ),
    },
    { key: 'gold_per_min', label: 'GPM', width: 50, color: '#c9a94a', render: (p) => num('#c9a94a')(p.gold_per_min) },
    { key: 'xp_per_min', label: 'XPM', width: 50, render: (p) => num('#dcd6c8')(p.xp_per_min) },
    { key: 'hero_damage', label: 'DMG', width: 62, render: (p) => num('#e8a070')(fmtK(p.hero_damage)) },
    { key: 'hero_healing', label: 'HEAL', width: 54, render: (p) => num(p.hero_healing > 0 ? '#8ec63f' : '#5a5446')(p.hero_healing ? fmtK(p.hero_healing) : '0') },
    {
      key: null,
      label: 'Rank',
      width: 92,
      render: (p) => (
        <span className="text-[12px]" style={{ color: '#9a8f66', fontFamily: 'var(--font-dota)' }}>
          {rankLabel(p.rank_tier) || '—'}
        </span>
      ),
    },
  ]

  const statsWidth = cols.reduce((s, c) => s + c.width + 12, 0)

  const HeaderCells = () => (
    <div className="flex items-center" style={{ height: TEAM_HEADER_H }}>
      {cols.map((c, i) => {
        const active = c.key != null && c.key === sortKey
        return (
          <div key={i} className="shrink-0 flex items-center justify-center px-1.5" style={{ width: c.width + 12 }}>
            {c.key ? (
              <button
                type="button"
                onClick={() => handleSort(c.key as SortKey)}
                className="text-[10px] font-bold uppercase tracking-wider select-none cursor-pointer"
                style={{ color: active ? (c.color ?? '#dcd6c8') : '#77715f', fontFamily: 'var(--font-dota)' }}
              >
                {c.label}
                {active && <span className="ml-0.5 opacity-80">{sortDir === 'desc' ? '↓' : '↑'}</span>}
              </button>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
                {c.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )

  const groupLabel = (label: string | JSX.Element, width?: number) => (
    <div
      className="shrink-0 flex items-center px-2 text-[10px] font-bold uppercase tracking-wider"
      style={{ height: TEAM_HEADER_H, minWidth: width, color: '#77715f', fontFamily: 'var(--font-dota)', borderLeft: '1px solid #1c1810' }}
    >
      {label}
    </div>
  )

  const teamSection = (players: MatchPlayer[], isRadiant: boolean) => {
    const sorted = sortPlayers(players)
    const color = isRadiant ? '#8ec63f' : '#d14a38'
    const kills = players.reduce((s, p) => s + p.kills, 0)
    const isWinner = isRadiant ? match.radiant_win : !match.radiant_win
    const enemies = isRadiant ? dire : radiant
    const enemyHeroes = enemies.map((e) => heroMap.get(e.hero_id)).filter((h): h is HeroStat => !!h)
    const maxAbilities = Math.max(0, ...players.map((p) => p.ability_upgrades_arr?.length ?? 0))

    return (
      <div style={{ background: '#100e0b', border: '1px solid #1c1810' }}>
        {/* Header band: team name (identity width) + column labels + extra groups */}
        <div className="flex items-stretch" style={{ borderBottom: '1px solid #241f16' }}>
          <div
            className="flex items-center gap-2 shrink-0"
            style={{ width: IDENTITY_W, height: TEAM_HEADER_H, padding: '0 10px', borderLeft: `3px solid ${color}`, background: `${color}12` }}
          >
            <span className="text-[14px] font-bold" style={{ color, fontFamily: 'var(--font-dota)' }}>
              {isRadiant ? 'The Radiant' : 'The Dire'}
            </span>
            <span className="text-[11px] uppercase tracking-wide" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
              Score: <span style={{ color }}>{kills}</span>
            </span>
            {isWinner && (
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ml-auto"
                style={{ background: '#123010', color: '#8ec63f', border: '1px solid #8ec63f44' }}
              >
                Winner
              </span>
            )}
          </div>
          <HeaderCells />
          {groupLabel(`${isRadiant ? 'Dire' : 'Radiant'} Heroes Killed`, 5 * 34 + 36 + 16)}
          {groupLabel(
            (<span className="inline-flex items-center gap-1">Support Items<GoldPip /></span>),
            256,
          )}
          {maxAbilities > 0 &&
            groupLabel(
              (
                <span className="flex items-center gap-[3px]">
                  {Array.from({ length: maxAbilities }, (_, i) => (
                    <span key={i} className="inline-block text-center tabular-nums" style={{ width: 26 }}>{i + 1}</span>
                  ))}
                </span>
              ),
            )}
        </div>

        {/* Rows */}
        {sorted.map((p) => {
          const active = selectedSlot === p.player_slot
          return (
            <button
              key={p.player_slot}
              type="button"
              onClick={() => setSelectedSlot(active ? null : p.player_slot)}
              className="flex items-stretch w-full text-left hover:bg-white/[0.03] cursor-pointer"
              style={{ borderBottom: '1px solid #1c1810', background: active ? '#241f16' : undefined }}
            >
              <PlayerIdentityCell player={p} hero={heroMap.get(p.hero_id)} width={IDENTITY_W} active={active} />
              <div className="flex items-center" style={{ height: ROW_H }}>
                {cols.map((c, i) => (
                  <div key={i} className="shrink-0 flex items-center justify-center px-1.5" style={{ width: c.width + 12 }}>
                    {c.render(p)}
                  </div>
                ))}
              </div>
              <div className="flex items-center shrink-0" style={{ height: ROW_H, borderLeft: '1px solid #1c1810' }}>
                <HeroKillsGroup player={p} enemies={enemyHeroes} />
              </div>
              <div className="flex items-center shrink-0" style={{ height: ROW_H, borderLeft: '1px solid #1c1810' }}>
                <SupportItemsGroup player={p} itemConst={itemConst} />
              </div>
              {maxAbilities > 0 && (
                <div className="flex items-center shrink-0" style={{ height: ROW_H, borderLeft: '1px solid #1c1810' }}>
                  <AbilityBuildGroup player={p} abilities={abilities} abilityIds={abilityIds} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="space-y-2" style={{ minWidth: IDENTITY_W + statsWidth }}>
        {teamSection(radiant, true)}
        {teamSection(dire, false)}
      </div>
    </div>
  )
}
