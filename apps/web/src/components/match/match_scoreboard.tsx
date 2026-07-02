import { useState } from 'react'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl, itemIconUrl } from '@/lib/utils'

type SortKey = 'kills' | 'deaths' | 'assists' | 'net_worth' | 'last_hits' | 'gold_per_min' | 'xp_per_min' | 'hero_damage' | 'tower_damage' | 'hero_healing'

const SORT_LABELS: Record<SortKey, string> = {
  kills: 'K',
  deaths: 'D',
  assists: 'A',
  net_worth: 'NET',
  last_hits: 'LH',
  gold_per_min: 'GPM',
  xp_per_min: 'XPM',
  hero_damage: 'HERO',
  tower_damage: 'BLDG',
  hero_healing: 'HEAL',
}

function rankLabel(tier: number | null): string {
  if (!tier) return ''
  const level = Math.floor(tier / 10)
  const stars = tier % 10
  const names = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const name = names[level] ?? ''
  return level < 8 ? `${name} ${stars}★` : name
}

function fmtK(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

function getItemTimestamps(player: MatchPlayer, idToName: Map<number, string>): (number | null)[] {
  const lastBuy: Record<string, number> = {}
  for (const e of player.purchase_log ?? []) {
    lastBuy[e.key] = e.time
  }
  const slots = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  return slots.map((id) => {
    if (!id) return null
    const name = idToName.get(id)
    return name != null && lastBuy[name] != null ? lastBuy[name] : null
  })
}

function formatTs(seconds: number): string {
  const neg = seconds < 0
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
}

function ItemCell({
  itemId,
  timestamp,
  idToName,
  size = 32,
}: {
  itemId: number
  timestamp: number | null
  idToName: Map<number, string>
  size?: number
}) {
  if (!itemId) {
    return (
      <div
        className="rounded-sm"
        style={{ width: size, height: Math.round(size * 0.73), background: '#091828' }}
      />
    )
  }
  const name = idToName.get(itemId) ?? ''
  return (
    <div className="flex flex-col items-center gap-[1px]">
      <img
        src={itemIconUrl(name)}
        alt={name}
        style={{ width: size, height: Math.round(size * 0.73) }}
        className="object-cover rounded-sm"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.15' }}
      />
      {timestamp != null && (
        <span className="text-[8px] font-mono leading-none" style={{ color: '#4a6a84' }}>
          {formatTs(timestamp)}
        </span>
      )}
    </div>
  )
}

function SortableHeader({
  sortKey,
  label,
  color,
  activeSort,
  sortDir,
  onSort,
  className = '',
}: {
  sortKey: SortKey
  label: string
  color?: string
  activeSort: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  className?: string
}) {
  const isActive = activeSort === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`text-[10px] font-bold uppercase tracking-wider select-none transition-colors ${className}`}
      style={{
        color: isActive ? (color ?? '#c8d6e5') : '#4a6a84',
        fontFamily: 'var(--font-dota)',
        cursor: 'pointer',
      }}
    >
      {label}
      {isActive && (
        <span className="ml-0.5 opacity-80">{sortDir === 'desc' ? '↓' : '↑'}</span>
      )}
    </button>
  )
}

function PlayerRow({
  player,
  hero,
  idToName,
  hasPurchaseData,
  activeSort,
  sortDir,
  onSort,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  idToName: Map<number, string>
  hasPurchaseData: boolean
  activeSort: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const timestamps = hasPurchaseData ? getItemTimestamps(player, idToName) : [null, null, null, null, null, null]
  const mainItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const bpItems = [player.backpack_0 ?? 0, player.backpack_1 ?? 0, player.backpack_2 ?? 0]
  const rank = rankLabel(player.rank_tier ?? null)
  const playerName = player.personaname ?? player.name ?? 'Anonymous'
  const accountId = player.account_id
  const heroShort = hero?.name.replace('npc_dota_hero_', '') ?? ''

  return (
    <div
      className="flex items-center gap-0 hover:bg-white/[0.03] transition-colors"
      style={{ borderBottom: '1px solid #0f2035', minHeight: '52px' }}
    >
      {/* Hero icon + player info — left panel */}
      <div
        className="flex items-center gap-2 shrink-0"
        style={{ width: '220px', padding: '6px 8px', background: '#050d18' }}
      >
        <div className="relative shrink-0">
          {hero ? (
            <a href={`/hero/${heroShort}`}>
              <img
                src={heroIconUrl(hero.name)}
                alt={hero.localized_name}
                className="rounded object-cover hover:ring-1 hover:ring-white/40"
                style={{ width: 44, height: 44 }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.src = heroIconFromPath(hero.icon)
                }}
              />
            </a>
          ) : (
            <div className="rounded bg-[#0a1828]" style={{ width: 44, height: 44 }} />
          )}
          {player.level != null && (
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
              style={{ background: '#0d1828', border: '1px solid #1a2e45', color: '#c8d6e5', fontFamily: 'var(--font-dota)' }}
            >
              {player.level}
            </div>
          )}
        </div>
        <div className="min-w-0">
          {accountId ? (
            <a
              href={`/player/${accountId}`}
              className="block text-[13px] font-semibold truncate hover:underline leading-tight"
              style={{ color: '#e0eaf4', fontFamily: 'var(--font-dota)' }}
            >
              {playerName}
            </a>
          ) : (
            <span
              className="block text-[13px] font-semibold truncate leading-tight"
              style={{ color: '#7a9ab8', fontFamily: 'var(--font-dota)' }}
            >
              {playerName}
            </span>
          )}
          {hero && (
            <a
              href={`/hero/${heroShort}`}
              className="text-[10px] truncate block hover:underline leading-tight"
              style={{ color: '#4a7a9a', fontFamily: 'var(--font-dota)', letterSpacing: '0.03em' }}
            >
              {hero.localized_name}
            </a>
          )}
          {rank && (
            <span className="text-[9px] leading-tight" style={{ color: '#3a5a6a', fontFamily: 'var(--font-dota)' }}>
              {rank}
            </span>
          )}
        </div>
      </div>

      {/* K */}
      <div className="w-9 shrink-0 text-center">
        <span className="text-[14px] font-bold tabular-nums" style={{ color: '#57c262', fontFamily: 'var(--font-dota)' }}>
          {player.kills}
        </span>
      </div>

      {/* D */}
      <div className="w-9 shrink-0 text-center">
        <span className="text-[14px] font-bold tabular-nums" style={{ color: '#e84747', fontFamily: 'var(--font-dota)' }}>
          {player.deaths}
        </span>
      </div>

      {/* A */}
      <div className="w-9 shrink-0 text-center">
        <span className="text-[14px] tabular-nums" style={{ color: '#c8d6e5', fontFamily: 'var(--font-dota)' }}>
          {player.assists}
        </span>
      </div>

      {/* NET */}
      <div className="w-[68px] shrink-0 text-center">
        <span className="text-[14px] font-bold tabular-nums" style={{ color: '#e8a832', fontFamily: 'var(--font-dota)' }}>
          {player.net_worth?.toLocaleString() ?? '—'}
        </span>
      </div>

      {/* Items — 6 slots */}
      <div className="flex gap-[3px] shrink-0 px-1">
        {mainItems.map((itemId, i) => (
          <ItemCell
            key={i}
            itemId={itemId}
            timestamp={timestamps[i]}
            idToName={idToName}
            size={34}
          />
        ))}
      </div>

      {/* Backpack — 3 slots */}
      <div className="flex gap-[3px] shrink-0 px-1">
        {bpItems.map((itemId, i) => (
          <ItemCell
            key={i}
            itemId={itemId}
            timestamp={null}
            idToName={idToName}
            size={28}
          />
        ))}
        {/* Neutral item */}
        <ItemCell
          itemId={player.item_neutral ?? 0}
          timestamp={null}
          idToName={idToName}
          size={28}
        />
      </div>

      {/* LH / DN */}
      <div className="w-[64px] shrink-0 text-center">
        <span className="text-[13px] tabular-nums" style={{ color: '#c8d6e5', fontFamily: 'var(--font-dota)' }}>
          {player.last_hits}
          <span style={{ color: '#2a4a5a' }}>/</span>
          {player.denies}
        </span>
      </div>

      {/* GPM */}
      <div className="w-[48px] shrink-0 text-center">
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#e8a832', fontFamily: 'var(--font-dota)' }}>
          {player.gold_per_min}
        </span>
      </div>

      {/* XPM */}
      <div className="w-[48px] shrink-0 text-center">
        <span className="text-[13px] tabular-nums" style={{ color: '#a8a0e8', fontFamily: 'var(--font-dota)' }}>
          {player.xp_per_min}
        </span>
      </div>

      {/* HEAL */}
      <div className="w-[52px] shrink-0 text-center">
        <span className="text-[13px] tabular-nums" style={{ color: '#c8d6e5', fontFamily: 'var(--font-dota)' }}>
          {player.hero_healing ? fmtK(player.hero_healing) : '0'}
        </span>
      </div>

      {/* Hero DMG */}
      <div className="w-[60px] shrink-0 text-center">
        <span className="text-[13px] tabular-nums" style={{ color: '#e8a070', fontFamily: 'var(--font-dota)' }}>
          {player.hero_damage ? fmtK(player.hero_damage) : '—'}
        </span>
      </div>

      {/* Building DMG */}
      <div className="w-[52px] shrink-0 text-center">
        <span className="text-[13px] tabular-nums" style={{ color: '#c8d6e5', fontFamily: 'var(--font-dota)' }}>
          {player.tower_damage ? fmtK(player.tower_damage) : '0'}
        </span>
      </div>
    </div>
  )
}

function HeaderRow({
  activeSort,
  sortDir,
  onSort,
}: {
  activeSort: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const sh = (k: SortKey, label?: string, color?: string, cls?: string) => (
    <SortableHeader
      sortKey={k}
      label={label ?? SORT_LABELS[k]}
      color={color}
      activeSort={activeSort}
      sortDir={sortDir}
      onSort={onSort}
      className={cls}
    />
  )

  return (
    <div
      className="flex items-center gap-0"
      style={{ borderBottom: '1px solid #1a2e45', background: '#050d18', padding: '4px 0' }}
    >
      <div className="shrink-0 text-[10px] font-bold uppercase tracking-wider" style={{ width: '220px', padding: '0 8px', color: '#4a6a84', fontFamily: 'var(--font-dota)' }}>
        Player
      </div>
      <div className="w-9 shrink-0 text-center">{sh('kills', 'K', '#57c262')}</div>
      <div className="w-9 shrink-0 text-center">{sh('deaths', 'D', '#e84747')}</div>
      <div className="w-9 shrink-0 text-center">{sh('assists', 'A')}</div>
      <div className="w-[68px] shrink-0 text-center">{sh('net_worth', 'NET', '#e8a832')}</div>
      <div className="shrink-0 px-1" style={{ minWidth: `${6 * 34 + 5 * 3 + 8}px` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4a6a84', fontFamily: 'var(--font-dota)' }}>Items</span>
      </div>
      <div className="shrink-0 px-1" style={{ minWidth: `${4 * 28 + 3 * 3 + 8}px` }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4a6a84', fontFamily: 'var(--font-dota)' }}>Backpack</span>
      </div>
      <div className="w-[64px] shrink-0 text-center">{sh('last_hits', 'LH/DN')}</div>
      <div className="w-[48px] shrink-0 text-center">{sh('gold_per_min', 'GPM', '#e8a832')}</div>
      <div className="w-[48px] shrink-0 text-center">{sh('xp_per_min', 'XPM', '#a8a0e8')}</div>
      <div className="w-[52px] shrink-0 text-center">{sh('hero_healing', 'HEAL')}</div>
      <div className="w-[60px] shrink-0 text-center">{sh('hero_damage', 'HERO', '#e8a070')}</div>
      <div className="w-[52px] shrink-0 text-center">{sh('tower_damage', 'BLDG')}</div>
    </div>
  )
}

function teamTotals(players: MatchPlayer[]) {
  return {
    kills: players.reduce((s, p) => s + p.kills, 0),
    deaths: players.reduce((s, p) => s + p.deaths, 0),
    assists: players.reduce((s, p) => s + p.assists, 0),
    net_worth: players.reduce((s, p) => s + p.net_worth, 0),
    last_hits: players.reduce((s, p) => s + p.last_hits, 0),
    denies: players.reduce((s, p) => s + p.denies, 0),
    gold_per_min: players.reduce((s, p) => s + p.gold_per_min, 0),
    xp_per_min: players.reduce((s, p) => s + p.xp_per_min, 0),
    hero_damage: players.reduce((s, p) => s + p.hero_damage, 0),
    tower_damage: players.reduce((s, p) => s + p.tower_damage, 0),
    hero_healing: players.reduce((s, p) => s + p.hero_healing, 0),
  }
}

function TotalsRow({ players }: { players: MatchPlayer[] }) {
  const t = teamTotals(players)
  const lbl = (v: string | number, color = '#8aa0b8') => (
    <span className="text-[12px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-dota)' }}>{v}</span>
  )
  return (
    <div
      className="flex items-center gap-0"
      style={{ borderBottom: '1px solid #0a1e30', background: '#030a14', padding: '4px 0' }}
    >
      <div className="shrink-0 text-right pr-3" style={{ width: '220px' }}>
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#2a4a5a', fontFamily: 'var(--font-dota)' }}>Team Total</span>
      </div>
      <div className="w-9 shrink-0 text-center">{lbl(t.kills, '#57c262')}</div>
      <div className="w-9 shrink-0 text-center">{lbl(t.deaths, '#e84747')}</div>
      <div className="w-9 shrink-0 text-center">{lbl(t.assists)}</div>
      <div className="w-[68px] shrink-0 text-center">{lbl(t.net_worth.toLocaleString(), '#e8a832')}</div>
      <div className="shrink-0 px-1" style={{ minWidth: `${6 * 34 + 5 * 3 + 8}px` }} />
      <div className="shrink-0 px-1" style={{ minWidth: `${4 * 28 + 3 * 3 + 8}px` }} />
      <div className="w-[64px] shrink-0 text-center">
        {lbl(`${t.last_hits}/${t.denies}`)}
      </div>
      <div className="w-[48px] shrink-0 text-center">{lbl(t.gold_per_min, '#e8a832')}</div>
      <div className="w-[48px] shrink-0 text-center">{lbl(t.xp_per_min, '#a8a0e8')}</div>
      <div className="w-[52px] shrink-0 text-center">{lbl(t.hero_healing ? fmtK(t.hero_healing) : '0')}</div>
      <div className="w-[60px] shrink-0 text-center">{lbl(t.hero_damage ? fmtK(t.hero_damage) : '—', '#e8a070')}</div>
      <div className="w-[52px] shrink-0 text-center">{lbl(t.tower_damage ? fmtK(t.tower_damage) : '0')}</div>
    </div>
  )
}

export function MatchScoreboard({
  match,
  heroStats,
  idToName,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
}) {
  const [activeSort, setActiveSort] = useState<SortKey>('net_worth')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const hasPurchaseData = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)

  function handleSort(key: SortKey) {
    if (activeSort === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setActiveSort(key)
      setSortDir(key === 'deaths' ? 'asc' : 'desc')
    }
  }

  function sortPlayers(players: MatchPlayer[]): MatchPlayer[] {
    return [...players].sort((a, b) => {
      const av = (a as unknown as Record<string, number>)[activeSort] ?? 0
      const bv = (b as unknown as Record<string, number>)[activeSort] ?? 0
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }

  const radiant = sortPlayers(match.players.filter((p) => p.player_slot < 128))
  const dire = sortPlayers(match.players.filter((p) => p.player_slot >= 128))

  function TeamSection({
    players,
    isRadiant,
    isWinner,
  }: {
    players: MatchPlayer[]
    isRadiant: boolean
    isWinner: boolean
  }) {
    const teamColor = isRadiant ? '#92c93a' : '#c23c2a'
    const teamName = isRadiant ? 'The Radiant' : 'The Dire'
    const kills = players.reduce((s, p) => s + p.kills, 0)

    return (
      <div>
        {/* Team header */}
        <div
          className="flex items-center gap-3 px-3 py-2"
          style={{ background: `${teamColor}14`, borderLeft: `3px solid ${teamColor}`, borderBottom: `1px solid ${teamColor}30` }}
        >
          <span
            className="text-[15px] font-bold uppercase tracking-wide"
            style={{ color: teamColor, fontFamily: 'var(--font-dota)' }}
          >
            {teamName}
          </span>
          {isWinner && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ background: '#0a2e14', color: '#57c262', border: '1px solid #57c26244' }}
            >
              Winner
            </span>
          )}
          <span className="text-[13px] ml-auto" style={{ color: '#4a6a84', fontFamily: 'var(--font-dota)' }}>
            Score: <span style={{ color: teamColor }}>{kills}</span>
          </span>
        </div>

        {/* Header row */}
        <HeaderRow activeSort={activeSort} sortDir={sortDir} onSort={handleSort} />

        {/* Player rows */}
        {players.map((p) => (
          <PlayerRow
            key={p.player_slot}
            player={p}
            hero={heroMap.get(p.hero_id)}
            idToName={idToName}
            hasPurchaseData={hasPurchaseData}
            activeSort={activeSort}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ))}

        <TotalsRow players={players} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: '1060px' }}>
        <TeamSection
          players={radiant}
          isRadiant={true}
          isWinner={match.radiant_win}
        />
        <div className="h-3" />
        <TeamSection
          players={dire}
          isRadiant={false}
          isWinner={!match.radiant_win}
        />
      </div>
    </div>
  )
}
