import { useState } from 'react'
import type { HeroStat, MatchPlayer } from 'types'
import { usePlayerProName } from './match_roster'
import { itemIconUrl, ITEM_CDN_FALLBACK } from '@/lib/utils'

/* Local asset first (itemIconUrl), Steam CDN only if the local file 404s. */
function onItemError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget
  const name = img.dataset.itemName
  if (name && !img.src.includes('cdn.cloudflare')) {
    img.src = `${ITEM_CDN_FALLBACK}/${name}.png`
  }
}

const CONSUMABLES = new Set([
  'clarity', 'tango', 'flask', 'faerie_fire', 'ward_observer', 'ward_sentry',
  'smoke_of_deceit', 'dust', 'tome_of_knowledge', 'cheese', 'enchanted_mango',
  'magic_stick', 'blood_grenade',
])

function fmt(n: number | undefined | null) {
  if (n == null) return '—'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function heroSbUrl(heroName: string): string {
  const short = heroName.replace('npc_dota_hero_', '')
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${short}_sb.png`
}

function ItemSlot({ itemId, idToName, size = 'md' }: { itemId: number; idToName: Map<number, string>; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-7 w-11' : 'h-5 w-8'
  if (!itemId) return <div className={`${cls} rounded-sm bg-[#0a1520] border border-[#1e3040] flex-shrink-0`} />
  const name = idToName.get(itemId)
  if (!name) return <div className={`${cls} rounded-sm bg-[#0a1520] border border-[#1e3040] flex-shrink-0`} />
  return (
    <img
      src={itemIconUrl(name)}
      alt={name}
      title={name.replace(/_/g, ' ')}
      data-item-name={name}
      onError={onItemError}
      className={`${cls} rounded-sm object-cover flex-shrink-0`}
    />
  )
}

function SnapshotItemSlot({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-7 w-11' : 'h-5 w-8'
  return (
    <img
      src={itemIconUrl(name)}
      alt={name}
      title={name.replace(/_/g, ' ')}
      data-item-name={name}
      onError={onItemError}
      className={`${cls} rounded-sm object-cover flex-shrink-0`}
    />
  )
}

type SortKey =
  | 'default' | 'level' | 'kills' | 'deaths' | 'assists' | 'last_hits'
  | 'net_worth' | 'gold_per_min' | 'xp_per_min' | 'hero_damage' | 'tower_damage' | 'hero_healing'

function Th({
  label, col, current, dir, onSort, className = '',
}: { label: string; col: SortKey; current: SortKey; dir: 'asc' | 'desc'; onSort: (c: SortKey) => void; className?: string }) {
  const active = current === col
  return (
    <th
      onClick={() => onSort(col)}
      className={`py-1.5 px-1 text-[10px] font-normal uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors ${active ? 'text-[#c8d6e5]' : 'text-[#3d6080]'} hover:text-[#6a9ab8] ${className}`}
    >
      {label}{active && <span className="ml-0.5 opacity-70">{dir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  )
}

function PlayerRow({
  player, hero, idToName, activeMinute, deathTimes, teamColor,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  idToName: Map<number, string>
  activeMinute: number
  deathTimes: number[]
  teamColor: string
}) {
  const personaName = player.personaname ?? player.name ?? 'Unknown'
  const proName = usePlayerProName(player, personaName)
  const snapshot = (player.gold_t?.length ?? 0) > 0
  const upToSeconds = activeMinute * 60

  const snapGold = snapshot && player.gold_t?.length
    ? player.gold_t[Math.min(activeMinute, player.gold_t.length - 1)] ?? null : null
  const snapLH = snapshot && player.lh_t?.length
    ? player.lh_t[Math.min(activeMinute, player.lh_t.length - 1)] ?? null : null
  const snapKills = snapshot ? (player.kills_log ?? []).filter((e) => e.time <= upToSeconds).length : null
  const snapDeaths = snapshot ? deathTimes.filter((t) => t <= upToSeconds).length : null
  const snapGPM = snapGold !== null && activeMinute > 0 ? Math.round(snapGold / activeMinute) : null
  const snapItems = snapshot && player.purchase_log
    ? player.purchase_log.filter((e) => e.time <= upToSeconds && !CONSUMABLES.has(e.key)).map((e) => e.key).slice(-6)
    : null

  const mainItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const backpackItems = [player.backpack_0, player.backpack_1, player.backpack_2]
  const dim = snapshot ? 'opacity-35' : ''
  const rankTier = player.rank_tier
  const rankMedal = rankTier ? `/ranks/rank_icon_${Math.floor(rankTier / 10)}.webp` : null

  return (
    <tr className="border-b border-[#1a2d3d]/60 hover:bg-[#142030]/50 transition-colors group">
      {/* Hero portrait + player info */}
      <td className="py-1 pr-2">
        <a
          href={player.account_id ? `/player/${player.account_id}` : '#'}
          className="flex items-center gap-2 group-hover:opacity-90"
        >
          {/* Landscape portrait with level badge */}
          <div className="relative flex-shrink-0" style={{ width: 88, height: 50 }}>
            {hero ? (
              <img
                src={heroSbUrl(hero.name)}
                alt={hero.localized_name}
                className="w-full h-full object-cover object-top rounded-sm"
                style={{ borderLeft: `2px solid ${teamColor}` }}
                onError={(e) => {
                  const img = e.currentTarget
                  img.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-full h-full rounded-sm bg-[#0a1520]" style={{ borderLeft: `2px solid ${teamColor}` }} />
            )}
            {/* Level badge */}
            <div
              className="absolute bottom-0 right-0 text-[9px] font-bold px-1 leading-tight"
              style={{ background: 'rgba(0,0,0,0.75)', color: '#c8d6e5' }}
            >
              {player.level}
            </div>
          </div>
          {/* Name + hero + rank */}
          <div className="min-w-0 w-[110px]">
            <div className="flex items-center gap-1 min-w-0">
              {rankMedal && <img src={rankMedal} alt="" className="h-3.5 w-3.5 flex-shrink-0 object-contain" />}
              <span className="text-[11px] text-[#c8d6e5] truncate font-medium leading-tight">
                {personaName}
                {proName && <span className="opacity-70"> [{proName}]</span>}
              </span>
            </div>
            {hero && <div className="text-[10px] text-[#4a7090] truncate leading-tight">{hero.localized_name}</div>}
          </div>
        </a>
      </td>

      {/* K */}
      <td className="py-1 px-1 text-center font-mono text-xs text-[#92c93a] font-semibold">
        {snapKills ?? player.kills}
      </td>
      {/* D */}
      <td className="py-1 px-1 text-center font-mono text-xs text-[#c23c2a] font-semibold">
        {snapDeaths ?? player.deaths}
      </td>
      {/* A */}
      <td className={`py-1 px-1 text-center font-mono text-xs text-[#5a7a94] ${dim}`}>
        {player.assists}
      </td>

      {/* NET worth — gold */}
      <td className="py-1 px-2 text-right font-mono text-xs font-semibold" style={{ color: '#d4a843' }}>
        {fmt(snapGold ?? player.net_worth)}
      </td>

      {/* Items 6 */}
      <td className="py-1 px-1">
        <div className="flex gap-0.5">
          {snapItems
            ? Array.from({ length: 6 }, (_, i) =>
                snapItems[i]
                  ? <SnapshotItemSlot key={i} name={snapItems[i]} />
                  : <div key={i} className="h-7 w-11 rounded-sm bg-[#0a1520] border border-[#1e3040] flex-shrink-0" />
              )
            : mainItems.map((id, i) => <ItemSlot key={i} itemId={id} idToName={idToName} />)
          }
        </div>
      </td>

      {/* Backpack 3 + neutral */}
      {!snapshot && (
        <td className="py-1 px-1">
          <div className="flex gap-0.5 items-center">
            {backpackItems.map((id, i) => <ItemSlot key={i} itemId={id} idToName={idToName} size="sm" />)}
            {player.item_neutral ? (
              <div className="ml-0.5">
                <ItemSlot itemId={player.item_neutral} idToName={idToName} size="sm" />
              </div>
            ) : null}
            {(player.aghanims_scepter === 1 || player.aghanims_shard === 1) && (
              <div className="flex gap-0.5 ml-0.5">
                {player.aghanims_scepter === 1 && (
                  <img src={itemIconUrl('aghanims_scepter')} title="Aghanim's Scepter" data-item-name="aghanims_scepter" onError={onItemError} className="h-5 w-5 rounded-sm" />
                )}
                {player.aghanims_shard === 1 && (
                  <img src={itemIconUrl('aghanims_shard')} title="Aghanim's Shard" data-item-name="aghanims_shard" onError={onItemError} className="h-5 w-5 rounded-sm" />
                )}
              </div>
            )}
          </div>
        </td>
      )}

      {/* LH / DN */}
      <td className="py-1 px-2 text-center font-mono text-xs text-[#c8d6e5] whitespace-nowrap">
        {snapLH ?? player.last_hits}
        <span className={`text-[#3d6080] ${dim}`}> / {player.denies}</span>
      </td>

      {/* GPM — gold */}
      <td className="py-1 px-2 text-right font-mono text-xs font-semibold" style={{ color: '#d4a843' }}>
        {snapGPM ?? player.gold_per_min}
      </td>

      {/* XPM */}
      <td className={`py-1 px-2 text-right font-mono text-xs text-[#5a7a94] ${dim}`}>
        {player.xp_per_min}
      </td>

      {/* HD */}
      <td className={`py-1 px-2 text-right font-mono text-xs text-[#c8d6e5] ${dim}`}>
        {fmt(player.hero_damage)}
      </td>

      {/* TD */}
      <td className={`py-1 px-2 text-right font-mono text-xs text-[#5a7a94] ${dim}`}>
        {fmt(player.tower_damage)}
      </td>

      {/* HEAL */}
      <td className={`py-1 px-2 text-right font-mono text-xs text-[#5a7a94] ${dim}`}>
        {fmt(player.hero_healing)}
      </td>
    </tr>
  )
}

function TeamTable({
  players, allPlayers, heroMap, idToName, isWinner, isRadiant,
  sortKey, sortDir, onSort, activeMinute, durationMinutes, score,
}: {
  players: MatchPlayer[]
  allPlayers: MatchPlayer[]
  heroMap: Map<number, HeroStat>
  idToName: Map<number, string>
  isWinner: boolean
  isRadiant: boolean
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  activeMinute: number
  durationMinutes: number
  score: number
}) {
  const snapshot = activeMinute < durationMinutes
  const teamColor = isRadiant ? '#92c93a' : '#c23c2a'
  const teamName = isRadiant ? 'The Radiant' : 'The Dire'

  // Build death times map
  const heroNameToSlot = new Map<string, number>()
  for (const p of allPlayers) {
    const h = heroMap.get(p.hero_id)
    if (h) heroNameToSlot.set(h.name, p.player_slot)
  }
  const deathTimesMap = new Map<number, number[]>()
  for (const killer of allPlayers) {
    for (const kill of killer.kills_log ?? []) {
      const slot = heroNameToSlot.get(kill.key)
      if (slot !== undefined) {
        const arr = deathTimesMap.get(slot) ?? []
        arr.push(kill.time)
        deathTimesMap.set(slot, arr)
      }
    }
  }

  const sorted = [...players].sort((a, b) => {
    if (sortKey === 'default') return a.player_slot - b.player_slot
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number)
  })

  const thProps = { current: sortKey, dir: sortDir, onSort }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse">
        {/* Team header */}
        <thead>
          <tr>
            <th
              colSpan={99}
              className="text-left py-1.5 px-3"
              style={{ background: `linear-gradient(90deg, ${teamColor}22 0%, transparent 60%)`, borderLeft: `3px solid ${teamColor}` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wide" style={{ color: teamColor }}>{teamName}</span>
                {isWinner && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest" style={{ background: `${teamColor}33`, color: teamColor, border: `1px solid ${teamColor}66` }}>
                    Winner
                  </span>
                )}
                <span className="text-xs text-[#3d6080] ml-1">Score: {score}</span>
              </div>
            </th>
          </tr>
          <tr style={{ background: '#0a1623' }}>
            <th className="py-1.5 pl-3 pr-2 text-left text-[10px] font-normal uppercase tracking-wide text-[#3d6080] whitespace-nowrap" style={{ minWidth: 210 }}>
              Hero / Player
            </th>
            <Th label="K" col="kills" {...thProps} className="text-center text-[#92c93a]" />
            <Th label="D" col="deaths" {...thProps} className="text-center text-[#c23c2a]" />
            <Th label="A" col="assists" {...thProps} className="text-center" />
            <Th label="NET" col="net_worth" {...thProps} className="text-right" />
            <th className="py-1.5 px-1 text-[10px] font-normal uppercase tracking-wide text-[#3d6080] whitespace-nowrap">Items</th>
            {!snapshot && <th className="py-1.5 px-1 text-[10px] font-normal uppercase tracking-wide text-[#3d6080]">Backpack</th>}
            <Th label="LH / DN" col="last_hits" {...thProps} className="text-center" />
            <Th label="GPM" col="gold_per_min" {...thProps} className="text-right" />
            <Th label="XPM" col="xp_per_min" {...thProps} className="text-right" />
            <Th label="HD" col="hero_damage" {...thProps} className="text-right" />
            <Th label="TD" col="tower_damage" {...thProps} className="text-right" />
            <Th label="HH" col="hero_healing" {...thProps} className="text-right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <PlayerRow
              key={p.player_slot}
              player={p}
              hero={heroMap.get(p.hero_id)}
              idToName={idToName}
              activeMinute={activeMinute}
              deathTimes={deathTimesMap.get(p.player_slot) ?? []}
              teamColor={teamColor}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Scoreboard({
  players, heroStats, radiantWin, idToName, activeMinute = 0, durationMinutes = 0,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
  radiantWin: boolean
  idToName: Map<number, string>
  activeMinute?: number
  durationMinutes?: number
}) {
  const [sortKey, setSortKey] = useState<SortKey>('default')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(col: SortKey) {
    if (sortKey === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(col); setSortDir('desc') }
  }

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = players.filter((p) => p.player_slot < 128)
  const dire = players.filter((p) => p.player_slot >= 128)
  const radiantScore = radiant.reduce((s, p) => s + p.kills, 0)
  const direScore = dire.reduce((s, p) => s + p.kills, 0)

  const shared = { allPlayers: players, heroMap, idToName, sortKey, sortDir, onSort: handleSort, activeMinute, durationMinutes }

  return (
    <div className="divide-y divide-[#1e3040]">
      <TeamTable players={radiant} isWinner={radiantWin} isRadiant score={radiantScore} {...shared} />
      <div className="py-2" />
      <TeamTable players={dire} isWinner={!radiantWin} isRadiant={false} score={direScore} {...shared} />
    </div>
  )
}
