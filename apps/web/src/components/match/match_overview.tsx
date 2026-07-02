import type { HeroStat, Match, MatchPlayer } from 'types'
import { heroIconFromPath, itemIconUrl } from '@/lib/utils'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF',
  1: '#66FFBF',
  2: '#BF00BF',
  3: '#F3F00B',
  4: '#FF6600',
  128: '#FE87C4',
  129: '#A1B477',
  130: '#65D9F7',
  131: '#007A00',
  132: '#A46900',
}

function heroSbUrl(heroName: string): string {
  const short = heroName.replace('npc_dota_hero_', '')
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${short}_sb.png`
}

function formatTs(seconds: number): string {
  const neg = seconds < 0
  const abs = Math.abs(seconds)
  const m = Math.floor(abs / 60)
  const s = abs % 60
  return `${neg ? '-' : ''}${m}:${String(s).padStart(2, '0')}`
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

function rankLabel(tier: number | null): string {
  if (!tier) return ''
  const level = Math.floor(tier / 10)
  const stars = tier % 10
  const names = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const name = names[level] ?? ''
  return level < 8 ? `${name} [${stars}]` : name
}

function teamTotals(players: MatchPlayer[]) {
  return {
    kills: players.reduce((s, p) => s + p.kills, 0),
    deaths: players.reduce((s, p) => s + p.deaths, 0),
    assists: players.reduce((s, p) => s + p.assists, 0),
    lh: players.reduce((s, p) => s + p.last_hits, 0),
    dn: players.reduce((s, p) => s + p.denies, 0),
    net: players.reduce((s, p) => s + p.net_worth, 0),
    gpm: players.reduce((s, p) => s + p.gold_per_min, 0),
    xpm: players.reduce((s, p) => s + p.xp_per_min, 0),
    hd: players.reduce((s, p) => s + p.hero_damage, 0),
    td: players.reduce((s, p) => s + p.tower_damage, 0),
    hh: players.reduce((s, p) => s + p.hero_healing, 0),
  }
}

function ColHeader({ label, color }: { label: string; color?: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted" style={color ? { color } : undefined}>
      {label}
    </div>
  )
}

function ItemSlot({ itemId, timestamp, idToName }: { itemId: number; timestamp: number | null; idToName: Map<number, string> }) {
  if (!itemId) {
    return <div className="flex flex-col items-center gap-0.5"><div className="w-9 h-[26px] rounded-sm bg-[#0d1d2e]" /></div>
  }
  const name = idToName.get(itemId) ?? ''
  return (
    <div className="flex flex-col items-center gap-0.5">
      <img
        src={itemIconUrl(name)}
        alt={name}
        className="w-9 h-[26px] object-cover rounded-sm"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
      />
      {timestamp != null && (
        <span className="text-[9px] font-mono leading-none" style={{ color: '#5a7a94' }}>
          {formatTs(timestamp)}
        </span>
      )}
    </div>
  )
}

function PlayerRow({
  player,
  hero,
  idToName,
  hasPurchaseData,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  idToName: Map<number, string>
  hasPurchaseData: boolean
}) {
  const slot = player.player_slot
  const color = PLAYER_COLORS[slot] ?? '#888'
  const timestamps = hasPurchaseData ? getItemTimestamps(player, idToName) : [null, null, null, null, null, null]

  const mainItems = [player.item_0, player.item_1, player.item_2, player.item_3, player.item_4, player.item_5]
  const bpItems = [player.backpack_0, player.backpack_1, player.backpack_2].filter(Boolean)
  const rank = rankLabel(player.rank_tier)

  const nameDisplay = player.personaname ?? player.name ?? 'Anonymous'

  return (
    <div className="flex items-start gap-2 py-2 border-b border-[#1a2e40] hover:bg-[#162030] transition-colors min-w-0">
      {/* Team color bar */}
      <div className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: color }} />

      {/* Hero portrait + player name */}
      <div className="flex items-center gap-2 w-[220px] shrink-0">
        <div className="relative shrink-0">
          <img
            src={hero ? heroSbUrl(hero.name) : ''}
            alt={hero?.localized_name ?? ''}
            className="w-[72px] h-[42px] object-cover object-top rounded"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              if (hero && !img.src.includes('icon')) {
                img.src = heroIconFromPath(hero.icon)
                img.className = 'w-[42px] h-[42px] object-cover rounded'
              }
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 rounded-tl flex items-center justify-center text-[9px] font-bold bg-[#0d1d2e]"
            style={{ color: '#c8d6e5' }}
          >
            {player.level}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-medium truncate" style={{ color: '#c8d6e5' }}>
            {nameDisplay}
          </div>
          {rank && (
            <div className="flex items-center gap-1 mt-0.5">
              {player.rank_tier && (
                <img
                  src={`/ranks/rank_icon_${Math.floor(player.rank_tier / 10)}.webp`}
                  alt=""
                  className="h-3 w-3 object-contain"
                />
              )}
              <span className="text-[10px]" style={{ color: '#5a7a94' }}>{rank}</span>
            </div>
          )}
        </div>
      </div>

      {/* K */}
      <div className="w-8 shrink-0 text-center">
        <span className="text-sm font-semibold" style={{ color: '#57c262' }}>{player.kills}</span>
      </div>

      {/* D */}
      <div className="w-8 shrink-0 text-center">
        <span className="text-sm font-semibold" style={{ color: '#e84747' }}>{player.deaths}</span>
      </div>

      {/* A */}
      <div className="w-8 shrink-0 text-center">
        <span className="text-sm" style={{ color: '#c8d6e5' }}>{player.assists}</span>
      </div>

      {/* LH / DN */}
      <div className="w-[72px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {player.last_hits}
        <span style={{ color: '#5a7a94' }}>/</span>
        {player.denies}
      </div>

      {/* NET */}
      <div className="w-[62px] shrink-0 text-center">
        <span className="text-sm font-bold" style={{ color: '#d4a843' }}>{fmtK(player.net_worth)}</span>
      </div>

      {/* GPM / XPM */}
      <div className="w-[80px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {player.gold_per_min}
        <span style={{ color: '#5a7a94' }}>/</span>
        {player.xp_per_min}
      </div>

      {/* HD */}
      <div className="w-[60px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {fmtK(player.hero_damage)}
      </div>

      {/* TD */}
      <div className="w-[48px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {player.tower_damage ? fmtK(player.tower_damage) : '-'}
      </div>

      {/* HH */}
      <div className="w-[40px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {player.hero_healing ? fmtK(player.hero_healing) : '-'}
      </div>

      {/* ITEMS */}
      <div className="w-[256px] shrink-0">
        <div className="flex gap-0.5">
          {mainItems.map((id, i) => (
            <ItemSlot key={i} itemId={id} timestamp={timestamps[i]} idToName={idToName} />
          ))}
        </div>
        {bpItems.length > 0 && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <span className="text-[9px]" style={{ color: '#5a7a94' }}>🎒</span>
            {bpItems.map((id, i) => (
              <ItemSlot key={i} itemId={id} timestamp={null} idToName={idToName} />
            ))}
          </div>
        )}
      </div>

      {/* BUFFS (neutral + aghs/shard) */}
      <div className="flex items-start gap-0.5 shrink-0">
        {player.item_neutral > 0 && (
          <img
            src={itemIconUrl(idToName.get(player.item_neutral) ?? '')}
            alt=""
            className="w-7 h-7 rounded-full object-cover"
          />
        )}
        {player.aghanims_scepter === 1 && (
          <img
            src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aghanims_scepter.png"
            alt="Aghs"
            className="w-7 h-7 object-contain"
          />
        )}
        {player.aghanims_shard === 1 && (
          <img
            src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/aghanims_shard.png"
            alt="Shard"
            className="w-7 h-7 object-contain"
          />
        )}
      </div>
    </div>
  )
}

function TotalsRow({ players }: { players: MatchPlayer[] }) {
  const t = teamTotals(players)
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#1a2e40] bg-[#0d1a26]">
      <div className="w-0.5 shrink-0" />
      <div className="w-[220px] shrink-0 text-right pr-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#5a7a94' }}>
        Team Total
      </div>
      <div className="w-8 shrink-0 text-center text-sm font-semibold" style={{ color: '#57c262' }}>{t.kills}</div>
      <div className="w-8 shrink-0 text-center text-sm font-semibold" style={{ color: '#e84747' }}>{t.deaths}</div>
      <div className="w-8 shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>{t.assists}</div>
      <div className="w-[72px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {t.lh}<span style={{ color: '#5a7a94' }}>/</span>{t.dn}
      </div>
      <div className="w-[62px] shrink-0 text-center text-sm font-bold" style={{ color: '#d4a843' }}>{fmtK(t.net)}</div>
      <div className="w-[80px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>
        {t.gpm}<span style={{ color: '#5a7a94' }}>/</span>{t.xpm}
      </div>
      <div className="w-[60px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>{fmtK(t.hd)}</div>
      <div className="w-[48px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>{t.td ? fmtK(t.td) : '-'}</div>
      <div className="w-[40px] shrink-0 text-center text-sm" style={{ color: '#c8d6e5' }}>{t.hh ? fmtK(t.hh) : '-'}</div>
      <div className="w-[256px] shrink-0" />
      <div className="shrink-0" />
    </div>
  )
}

function HeaderRow() {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[#1a2e40]">
      <div className="w-0.5 shrink-0" />
      <div className="w-[220px] shrink-0"><ColHeader label="Player" /></div>
      <div className="w-8 shrink-0 text-center"><ColHeader label="K" color="#57c262" /></div>
      <div className="w-8 shrink-0 text-center"><ColHeader label="D" color="#e84747" /></div>
      <div className="w-8 shrink-0 text-center"><ColHeader label="A" /></div>
      <div className="w-[72px] shrink-0 text-center"><ColHeader label="LH / DN" /></div>
      <div className="w-[62px] shrink-0 text-center"><ColHeader label="NET" color="#d4a843" /></div>
      <div className="w-[80px] shrink-0 text-center"><ColHeader label="GPM / XPM" /></div>
      <div className="w-[60px] shrink-0 text-center"><ColHeader label="HD" /></div>
      <div className="w-[48px] shrink-0 text-center"><ColHeader label="TD" /></div>
      <div className="w-[40px] shrink-0 text-center"><ColHeader label="HH" /></div>
      <div className="w-[256px] shrink-0"><ColHeader label="Items" /></div>
      <div className="shrink-0"><ColHeader label="Buffs" /></div>
    </div>
  )
}

function DraftSeparator({
  picksBans,
  heroStats,
}: {
  picksBans: Match['picks_bans']
  heroStats: HeroStat[]
}) {
  if (!picksBans?.length) return null
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))

  const radiantPicks = picksBans.filter((pb) => pb.team === 0 && pb.is_pick).sort((a, b) => a.order - b.order)
  const radiantBans = picksBans.filter((pb) => pb.team === 0 && !pb.is_pick).sort((a, b) => a.order - b.order)

  if (radiantPicks.length === 0 && radiantBans.length === 0) return null

  return (
    <div className="flex items-center gap-3 py-3 px-2 border-y border-[#1a2e40] bg-[#0a1520]">
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: '#5a7a94' }}>
        Radiant Draft
      </div>
      <div className="flex gap-1">
        {radiantPicks.map((pb) => {
          const hero = heroMap.get(pb.hero_id)
          return (
            <div key={pb.order} className="flex flex-col items-center gap-0.5">
              <img
                src={hero ? heroIconFromPath(hero.icon) : ''}
                alt={hero?.localized_name ?? ''}
                className="w-8 h-8 rounded object-cover"
              />
              <span className="text-[8px] font-mono" style={{ color: '#92c93a' }}>P{pb.order + 1}</span>
            </div>
          )
        })}
      </div>
      {radiantBans.length > 0 && (
        <>
          <div className="text-[10px]" style={{ color: '#5a7a94' }}>vs bans</div>
          <div className="flex gap-1">
            {radiantBans.map((pb, i) => {
              const hero = heroMap.get(pb.hero_id)
              return (
                <div key={pb.order} className="relative flex flex-col items-center gap-0.5">
                  <div className="relative">
                    <img
                      src={hero ? heroIconFromPath(hero.icon) : ''}
                      alt={hero?.localized_name ?? ''}
                      className="w-8 h-8 rounded object-cover grayscale opacity-60"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-full h-0.5 rotate-45 rounded" style={{ background: '#e84747' }} />
                    </div>
                  </div>
                  <span className="text-[8px] font-mono" style={{ color: '#e84747' }}>B{i + 1}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function MatchOverview({
  match,
  heroStats,
  idToName,
}: {
  match: Match
  heroStats: HeroStat[]
  idToName: Map<number, string>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = match.players.filter((p) => p.player_slot < 128)
  const dire = match.players.filter((p) => p.player_slot >= 128)
  const hasPurchaseData = match.players.some((p) => (p.purchase_log?.length ?? 0) > 0)

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
    const teamName = isRadiant ? 'Radiant' : 'Dire'

    return (
      <div>
        <div
          className="flex items-center gap-2 px-2 py-1.5"
          style={{ borderLeft: `3px solid ${teamColor}`, background: `${teamColor}10` }}
        >
          <span className="text-sm font-semibold" style={{ color: teamColor }}>{teamName}</span>
          <span className="text-sm" style={{ color: '#5a7a94' }}>- Overview</span>
          {isWinner && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: '#1a4a2a', color: '#57c262', border: '1px solid #57c262' }}
            >
              Winner
            </span>
          )}
        </div>
        <HeaderRow />
        {players.map((p) => (
          <PlayerRow
            key={p.player_slot}
            player={p}
            hero={heroMap.get(p.hero_id)}
            idToName={idToName}
            hasPurchaseData={hasPurchaseData}
          />
        ))}
        <TotalsRow players={players} />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1100px]">
        <TeamSection players={radiant} isRadiant={true} isWinner={match.radiant_win} />
        <DraftSeparator picksBans={match.picks_bans} heroStats={heroStats} />
        <TeamSection players={dire} isRadiant={false} isWinner={!match.radiant_win} />
      </div>
    </div>
  )
}
