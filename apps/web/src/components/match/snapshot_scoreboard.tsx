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

function itemsAtTime(player: MatchPlayer, upToSeconds: number): string[] {
  if (!player.purchase_log) return []
  return player.purchase_log
    .filter((e) => e.time <= upToSeconds && !CONSUMABLES.has(e.key))
    .map((e) => e.key)
    .slice(-6)
}

function goldAtMinute(player: MatchPlayer, minute: number): number | null {
  if (!player.gold_t?.length) return null
  return player.gold_t[Math.min(minute, player.gold_t.length - 1)] ?? null
}

function lhAtMinute(player: MatchPlayer, minute: number): number | null {
  if (!player.lh_t?.length) return null
  return player.lh_t[Math.min(minute, player.lh_t.length - 1)] ?? null
}

function killsAtTime(player: MatchPlayer, upToSeconds: number): number {
  return (player.kills_log ?? []).filter((e) => e.time <= upToSeconds).length
}

function gpmAtMinute(player: MatchPlayer, minute: number): number | null {
  const g = goldAtMinute(player, minute)
  if (g === null || minute === 0) return null
  return Math.round(g / minute)
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function PlayerRow({
  player,
  hero,
  activeMinute,
  isRadiant,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  activeMinute: number
  isRadiant: boolean
}) {
  const upToSeconds = activeMinute * 60
  const items = itemsAtTime(player, upToSeconds)
  const gold = goldAtMinute(player, activeMinute)
  const lh = lhAtMinute(player, activeMinute)
  const kills = killsAtTime(player, upToSeconds)
  const gpm = gpmAtMinute(player, activeMinute)

  return (
    <tr className="border-t border-border/20 text-xs hover:bg-white/[0.02]">
      <td className="py-1.5 pr-2">
        <a
          href={player.account_id ? `/player/${player.account_id}` : '#'}
          className="flex items-center gap-1.5 hover:text-accent min-w-0"
        >
          {hero && (
            <img
              src={heroIconFromPath(hero.icon)}
              alt={hero.localized_name}
              className="h-6 w-6 rounded flex-shrink-0"
            />
          )}
          <span className="truncate max-w-[90px]">
            {player.personaname ?? player.name ?? '—'}
          </span>
        </a>
      </td>
      <td className="py-1.5 pr-2 text-center font-mono font-semibold text-foreground">
        {kills}
      </td>
      <td className={`py-1.5 pr-2 text-right font-mono font-semibold ${isRadiant ? 'text-radiant' : 'text-dire'}`}>
        {gold !== null ? fmt(gold) : fmt(player.net_worth)}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono text-muted">
        {gpm !== null ? gpm : player.gold_per_min}
      </td>
      <td className="py-1.5 pr-2 text-right font-mono text-muted">
        {lh !== null ? lh : player.last_hits}
      </td>
      <td className="py-1.5">
        <div className="flex items-center gap-0.5">
          {items.length > 0
            ? items.map((name, i) => (
                <img
                  key={i}
                  src={itemIconUrl(name)}
                  alt={name}
                  title={name.replace(/_/g, ' ')}
                  data-item-name={name}
                  onError={onItemError}
                  className="h-5 w-8 rounded object-cover"
                />
              ))
            : Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-5 w-8 rounded bg-border/40" />
              ))}
        </div>
      </td>
    </tr>
  )
}

function TeamTable({
  players,
  heroMap,
  activeMinute,
  isRadiant,
}: {
  players: MatchPlayer[]
  heroMap: Map<number, HeroStat>
  activeMinute: number
  isRadiant: boolean
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="text-left text-[10px] text-muted">
          <th className="pb-1 font-normal">Player</th>
          <th className="pb-1 text-center font-normal pr-2">K</th>
          <th className="pb-1 text-right font-normal pr-2">Gold</th>
          <th className="pb-1 text-right font-normal pr-2">GPM</th>
          <th className="pb-1 text-right font-normal pr-2">LH</th>
          <th className="pb-1 font-normal">Items</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <PlayerRow
            key={p.player_slot}
            player={p}
            hero={heroMap.get(p.hero_id)}
            activeMinute={activeMinute}
            isRadiant={isRadiant}
          />
        ))}
      </tbody>
    </table>
  )
}

export function SnapshotScoreboard({
  players,
  heroStats,
  activeMinute,
  radiantWin,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
  activeMinute: number
  radiantWin: boolean
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = players.filter((p) => p.player_slot < 128)
  const dire = players.filter((p) => p.player_slot >= 128)

  const radiantGold = radiant.reduce((sum, p) => sum + (goldAtMinute(p, activeMinute) ?? p.net_worth), 0)
  const direGold = dire.reduce((sum, p) => sum + (goldAtMinute(p, activeMinute) ?? p.net_worth), 0)

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold text-radiant ${radiantWin ? 'after:content-["_★"]' : ''}`}>Radiant</span>
        <span className="font-mono text-muted">
          <span className="text-radiant">{fmt(radiantGold)}</span>
          <span className="mx-1">vs</span>
          <span className="text-dire">{fmt(direGold)}</span>
        </span>
        <span className={`font-semibold text-dire ${!radiantWin ? 'after:content-["_★"]' : ''}`}>Dire</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TeamTable players={radiant} heroMap={heroMap} activeMinute={activeMinute} isRadiant={true} />
        <TeamTable players={dire} heroMap={heroMap} activeMinute={activeMinute} isRadiant={false} />
      </div>
    </div>
  )
}
