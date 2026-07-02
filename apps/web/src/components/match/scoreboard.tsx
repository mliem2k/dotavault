import { useState } from 'react'
import type { HeroStat, MatchPlayer } from 'types'
import { heroIconFromPath, itemIconUrl, ITEM_CDN_FALLBACK } from '@/lib/utils'

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

function ItemSlot({
  itemId,
  idToName,
  size = 'md',
}: { itemId: number; idToName: Map<number, string>; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'h-7 w-12' : 'h-5 w-8'
  if (!itemId) return <div className={`${sizeClass} rounded bg-card border border-border/40 flex-shrink-0`} />
  const name = idToName.get(itemId)
  if (!name) return <div className={`${sizeClass} rounded bg-card border border-border/40 flex-shrink-0`} />
  return (
    <img
      src={itemIconUrl(name)}
      alt={name}
      title={name.replace(/_/g, ' ')}
      data-item-name={name}
      onError={onItemError}
      className={`${sizeClass} rounded object-cover flex-shrink-0`}
    />
  )
}

function SnapshotItemSlot({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'h-7 w-12' : 'h-5 w-8'
  return (
    <img
      src={itemIconUrl(name)}
      alt={name}
      title={name.replace(/_/g, ' ')}
      data-item-name={name}
      onError={onItemError}
      className={`${sizeClass} rounded object-cover flex-shrink-0`}
    />
  )
}

type SortKey =
  | 'default'
  | 'level'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'last_hits'
  | 'net_worth'
  | 'gold_per_min'
  | 'xp_per_min'
  | 'hero_damage'
  | 'tower_damage'
  | 'hero_healing'

function SortHeader({
  label,
  col,
  current,
  dir,
  onSort,
  className = '',
}: {
  label: string
  col: SortKey
  current: SortKey
  dir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  className?: string
}) {
  const active = current === col
  return (
    <th
      className={`pb-2 font-normal cursor-pointer select-none text-xs whitespace-nowrap ${active ? 'text-foreground' : 'text-muted'} hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      {active && <span className="ml-0.5 opacity-60">{dir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  )
}

function PlayerRow({
  player,
  hero,
  idToName,
  activeMinute,
  deathTimes,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  idToName: Map<number, string>
  activeMinute: number
  deathTimes: number[]
}) {
  const snapshot = (player.gold_t?.length ?? 0) > 0
  const upToSeconds = activeMinute * 60

  const snapGold = snapshot && player.gold_t?.length
    ? player.gold_t[Math.min(activeMinute, player.gold_t.length - 1)] ?? null
    : null
  const snapLH = snapshot && player.lh_t?.length
    ? player.lh_t[Math.min(activeMinute, player.lh_t.length - 1)] ?? null
    : null
  const snapKills = snapshot
    ? (player.kills_log ?? []).filter((e) => e.time <= upToSeconds).length
    : null
  const snapDeaths = snapshot
    ? deathTimes.filter((t) => t <= upToSeconds).length
    : null
  const snapGPM = snapGold !== null && activeMinute > 0
    ? Math.round(snapGold / activeMinute)
    : null
  const snapItems = snapshot && player.purchase_log
    ? player.purchase_log
        .filter((e) => e.time <= upToSeconds && !CONSUMABLES.has(e.key))
        .map((e) => e.key)
        .slice(-6)
    : null

  const mainItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const backpackItems = [player.backpack_0, player.backpack_1, player.backpack_2]

  // Dim assists (no per-minute data) when scrubbing
  const dim = snapshot ? 'opacity-40' : ''

  const rankTier = player.rank_tier
  const rankMedal = rankTier ? `/ranks/rank_icon_${Math.floor(rankTier / 10)}.webp` : null

  return (
    <tr className="border-b border-border/30 hover:bg-card/50 transition-colors">
      <td className="py-2 pr-3 w-[180px]">
        <a
          href={player.account_id ? `/player/${player.account_id}` : '#'}
          className="flex items-center gap-2 hover:text-accent"
        >
          {hero && (
            <img
              src={heroIconFromPath(hero.icon)}
              alt={hero.localized_name}
              className="h-8 w-8 rounded flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {rankMedal && (
                <img src={rankMedal} alt="" className="h-4 w-4 flex-shrink-0 object-contain" />
              )}
              <div className="text-sm text-foreground leading-tight truncate">
                {player.personaname ?? player.name ?? 'Unknown'}
              </div>
            </div>
            {hero && <div className="text-xs text-muted truncate">{hero.localized_name}</div>}
          </div>
        </a>
      </td>
      <td className={`py-2 px-2 text-center font-mono text-xs text-foreground ${dim}`}>
        {player.level}
      </td>
      <td className="py-2 px-2 text-center font-mono text-xs whitespace-nowrap">
        <span className="text-radiant">{snapKills ?? player.kills}</span>
        <span className="text-muted mx-0.5">/</span>
        <span className="text-dire">{snapDeaths ?? player.deaths}</span>
        <span className="text-muted mx-0.5">/</span>
        <span className={`text-muted ${dim}`}>{player.assists}</span>
      </td>
      <td className="py-2 px-2 text-center font-mono text-xs text-muted whitespace-nowrap">
        <span>{snapLH ?? player.last_hits}</span>
        <span className={dim}> / {player.denies}</span>
      </td>
      <td className="py-2 px-2 text-right font-mono text-xs text-accent font-medium">
        {fmt(snapGold ?? player.net_worth)}
      </td>
      <td className="py-2 px-2 text-center font-mono text-xs text-muted whitespace-nowrap">
        <span>{snapGPM ?? player.gold_per_min}</span>
        <span className={dim}> / {player.xp_per_min}</span>
      </td>
      <td className={`py-2 px-2 text-right font-mono text-xs text-muted ${dim}`}>{fmt(player.hero_damage)}</td>
      <td className={`py-2 px-2 text-right font-mono text-xs text-muted ${dim}`}>{fmt(player.tower_damage)}</td>
      <td className={`py-2 px-2 text-right font-mono text-xs text-muted ${dim}`}>{fmt(player.hero_healing)}</td>
      <td className="py-2 px-2">
        {snapItems ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 6 }, (_, i) =>
                snapItems[i] ? (
                  <SnapshotItemSlot key={i} name={snapItems[i]} size="md" />
                ) : (
                  <div key={i} className="h-7 w-12 rounded bg-card border border-border/40 flex-shrink-0" />
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-0.5">
              {mainItems.map((id, i) => (
                <ItemSlot key={i} itemId={id} idToName={idToName} size="md" />
              ))}
            </div>
            <div className="flex gap-0.5 items-center">
              {backpackItems.map((id, i) => (
                <ItemSlot key={i} itemId={id} idToName={idToName} size="sm" />
              ))}
              {player.item_neutral ? (
                <div className="ml-1">
                  <ItemSlot itemId={player.item_neutral} idToName={idToName} size="sm" />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </td>
      {!snapshot && (
        <td className="py-2 px-2">
          <div className="flex gap-1 items-center">
            {player.aghanims_scepter === 1 && (
              <img
                src={itemIconUrl('aghanims_scepter')}
                title="Aghanim's Scepter"
                data-item-name="aghanims_scepter"
                onError={onItemError}
                className="h-6 w-6 rounded"
              />
            )}
            {player.aghanims_shard === 1 && (
              <img
                src={itemIconUrl('aghanims_shard')}
                title="Aghanim's Shard"
                data-item-name="aghanims_shard"
                onError={onItemError}
                className="h-6 w-6 rounded"
              />
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

function TeamTable({
  players,
  allPlayers,
  heroMap,
  idToName,
  isWinner,
  teamLabel,
  sortKey,
  sortDir,
  onSort,
  activeMinute,
  durationMinutes,
}: {
  players: MatchPlayer[]
  allPlayers: MatchPlayer[]
  heroMap: Map<number, HeroStat>
  idToName: Map<number, string>
  isWinner: boolean
  teamLabel: string
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (col: SortKey) => void
  activeMinute: number
  durationMinutes: number
}) {
  const snapshot = activeMinute < durationMinutes

  // Build death times for each player by cross-referencing all kills_log entries
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

  const labelColor = isWinner
    ? teamLabel.startsWith('Radiant')
      ? 'text-radiant'
      : 'text-dire'
    : 'text-muted'

  return (
    <div>
      <div className={`mb-2 text-xs font-semibold tracking-wide uppercase ${labelColor}`}>
        {teamLabel}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max">
          <thead>
            <tr className="text-left">
              <th className="pb-2 font-normal text-xs text-muted pr-3">Player</th>
              <SortHeader label="LVL" col="level" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-center" />
              <SortHeader label="K / D / A" col="kills" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-center" />
              <SortHeader label="LH / DN" col="last_hits" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-center" />
              <SortHeader label="NET" col="net_worth" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-right" />
              <SortHeader label="GPM / XPM" col="gold_per_min" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-center" />
              <SortHeader label="HD" col="hero_damage" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-right" />
              <SortHeader label="TD" col="tower_damage" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-right" />
              <SortHeader label="HH" col="hero_healing" current={sortKey} dir={sortDir} onSort={onSort} className="px-2 text-right" />
              <th className="pb-2 font-normal text-xs text-muted px-2">Items</th>
              {!snapshot && <th className="pb-2 font-normal text-xs text-muted px-2">Buffs</th>}
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Scoreboard({
  players,
  heroStats,
  radiantWin,
  idToName,
  activeMinute = 0,
  durationMinutes = 0,
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
    if (sortKey === col) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(col)
      setSortDir('desc')
    }
  }

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = players.filter((p) => p.player_slot < 128)
  const dire = players.filter((p) => p.player_slot >= 128)

  const sharedProps = { allPlayers: players, heroMap, idToName, sortKey, sortDir, onSort: handleSort, activeMinute, durationMinutes }

  return (
    <div className="space-y-6">
      <TeamTable
        players={radiant}
        isWinner={radiantWin}
        teamLabel={`Radiant${radiantWin ? ' · Victory' : ''}`}
        {...sharedProps}
      />
      <TeamTable
        players={dire}
        isWinner={!radiantWin}
        teamLabel={`Dire${!radiantWin ? ' · Victory' : ''}`}
        {...sharedProps}
      />
    </div>
  )
}
