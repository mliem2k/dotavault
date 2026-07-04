import type { HeroStat, ItemConst, MatchPlayer } from 'types'
import { formatDuration, heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { ItemIcon } from './item_icon'
import { PlayerNameLink } from './match_roster'

/* Purchases tab — one column per player, chronological item builds
   (consumables filtered out), full page width. */

const C = {
  label: '#8a97a0',
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

const CONSUMABLES = new Set([
  'tpscroll', 'flask', 'clarity', 'faerie_fire', 'smoke_of_deceit',
  'dust', 'ward_observer', 'ward_sentry', 'tome_of_knowledge', 'tango',
  'tango_single', 'enchanted_mango', 'blood_grenade',
])

function PlayerColumn({
  player,
  hero,
  itemConst,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  itemConst: Record<string, ItemConst>
}) {
  const purchases = (player.purchase_log ?? []).filter((e) => !CONSUMABLES.has(e.key))
  return (
    <div style={{ background: C.panel }}>
      {/* column header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: C.panelDark }}>
        {hero && (
          <img
            src={heroIconUrl(hero.name)}
            alt=""
            style={{ width: 38, height: 38 }}
            onError={(e) => {
              const img = e.currentTarget
              img.onerror = null
              img.src = heroIconFromPath(hero.icon)
            }}
          />
        )}
        <div className="min-w-0" style={{ fontFamily: 'var(--font-dota)' }}>
          <div className="text-[15px] truncate" style={{ color: C.white }}>{hero?.localized_name}</div>
          <PlayerNameLink player={player} className="block text-[12px] truncate" style={{ color: C.dim }} />
        </div>
      </div>
      {/* purchase list */}
      <div className="px-2 py-1.5">
        {purchases.map((e, i) => {
          const meta = itemConst[e.key]
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static purchase list
            <div key={i} className="flex items-center gap-2.5 py-[3px]">
              <span className="w-12 text-right text-[13px] tabular-nums shrink-0" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
                {formatDuration(Math.max(0, e.time))}
              </span>
              <ItemIcon name={e.key} meta={meta} width={34} height={25} />
              <span className="text-[13px] truncate" style={{ color: C.text, fontFamily: 'var(--font-dota)' }}>
                {meta?.dname ?? e.key.replace(/_/g, ' ')}
              </span>
            </div>
          )
        })}
        {purchases.length === 0 && (
          <div className="py-2 text-[13px]" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>No purchases.</div>
        )}
      </div>
    </div>
  )
}

export function MatchPurchases({
  players,
  heroStats,
  itemConst,
}: {
  players: MatchPlayer[]
  heroStats: HeroStat[]
  itemConst: Record<string, ItemConst>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = players.filter((p) => p.player_slot < 128)
  const dire = players.filter((p) => p.player_slot >= 128)

  const hasAny = players.some((p) => (p.purchase_log?.length ?? 0) > 0)
  if (!hasAny) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm" style={{ color: C.dim, fontFamily: 'var(--font-dota)' }}>
          No purchase data available for this match.
        </span>
      </div>
    )
  }

  const teamSection = (team: MatchPlayer[], isRadiant: boolean) => (
    <div>
      <div
        className="text-[17px] mb-2 px-1"
        style={{
          color: isRadiant ? C.green : C.red,
          fontFamily: 'var(--font-dota)',
          textShadow: `0 1px 3px rgba(0,0,0,0.9), 0 0 10px ${isRadiant ? C.green : C.red}44`,
        }}
      >
        {isRadiant ? 'The Radiant' : 'The Dire'}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {team.map((p) => (
          <PlayerColumn key={p.player_slot} player={p} hero={heroMap.get(p.hero_id)} itemConst={itemConst} />
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {teamSection(radiant, true)}
      {teamSection(dire, false)}
    </div>
  )
}
