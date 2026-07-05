import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { playerColor } from '@/lib/dotaconst'
import { abilityIconCdn, abilityIconUrl, heroIconFromPath, heroIconUrl, itemIconUrl, ITEM_CDN_FALLBACK } from '@/lib/utils'

/* Casts tab (OpenDota-style): per player, how often each ability and each
   active item was used (ability_uses / item_uses), plus hit counts
   (hero_hits: the 'null' key is plain attacks). Parsed matches only. */

const C = {
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

// Non-ability keys that show up in ability_uses.
const SKIP_KEYS = new Set(['ability_lamp_use', 'ability_capture', 'twin_gate_portal_warp'])

function sortedEntries(rec: Record<string, number> | null | undefined): [string, number][] {
  return Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1])
}

function AbilityUse({ name, count, meta }: { name: string; count: number; meta: AbilityConst | undefined }) {
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5"
      style={{ background: 'rgba(8,10,12,0.6)', border: '1px solid #22282c' }}
      title={`${meta?.dname ?? name}: used ${count} times`}
    >
      <img
        src={abilityIconUrl(name)}
        alt=""
        style={{ width: 22, height: 22 }}
        onError={(e) => {
          const img = e.currentTarget
          if (img.dataset.step !== '1') {
            img.dataset.step = '1'
            img.src = abilityIconCdn(name, meta?.img)
          } else {
            img.onerror = null
            img.style.opacity = '0.15'
          }
        }}
      />
      <span className="text-[12px] tabular-nums" style={{ color: C.text }}>{count}</span>
    </div>
  )
}

function ItemUse({ name, count, meta }: { name: string; count: number; meta: ItemConst | undefined }) {
  return (
    <div
      className="flex items-center gap-1 px-1 py-0.5"
      style={{ background: 'rgba(8,10,12,0.6)', border: '1px solid #22282c' }}
      title={`${meta?.dname ?? name}: used ${count} times`}
    >
      <img
        src={itemIconUrl(name)}
        alt=""
        style={{ width: 28, height: 20, objectFit: 'cover' }}
        onError={(e) => {
          const img = e.currentTarget
          if (!img.src.includes('cdn.cloudflare')) {
            img.src = `${ITEM_CDN_FALLBACK}/${name}.png`
          } else {
            img.onerror = null
            img.style.opacity = '0.15'
          }
        }}
      />
      <span className="text-[12px] tabular-nums" style={{ color: C.text }}>{count}</span>
    </div>
  )
}

function PlayerCasts({
  player,
  hero,
  abilityConst,
  itemConst,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  abilityConst: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const abilities = sortedEntries(player.ability_uses).filter(([k]) => !SKIP_KEYS.has(k))
  const items = sortedEntries(player.item_uses).filter(([k]) => k !== 'tpscroll')
  const tp = player.item_uses?.tpscroll ?? 0
  const attacks = player.hero_hits?.null ?? 0
  const isRadiant = player.player_slot < 128

  return (
    <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="mb-1.5 flex items-center gap-2">
        <span style={{ width: 3, height: 22, background: playerColor(player.player_slot) }} />
        <img
          src={hero ? heroIconUrl(hero.name) : ''}
          alt=""
          style={{ width: 26, height: 26 }}
          onError={(e) => {
            if (!hero) return
            const img = e.currentTarget
            img.onerror = null
            img.src = heroIconFromPath(hero.icon)
          }}
        />
        <span className="text-[13px]" style={{ color: isRadiant ? C.green : C.red }}>
          {hero?.localized_name ?? 'Unknown'}
        </span>
        <span className="truncate text-[13px]" style={{ color: C.dim }}>{player.personaname ?? 'Anonymous'}</span>
        <span className="ml-auto shrink-0 text-[12px] tabular-nums" style={{ color: C.dim }}>
          {attacks > 0 ? `${attacks.toLocaleString()} attacks landed` : ''}
          {tp > 0 ? `${attacks > 0 ? ' · ' : ''}${tp} TPs` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {abilities.map(([name, count]) => (
          <AbilityUse key={name} name={name} count={count} meta={abilityConst[name]} />
        ))}
        {items.map(([name, count]) => (
          <ItemUse key={name} name={name} count={count} meta={itemConst[name]} />
        ))}
        {abilities.length === 0 && items.length === 0 && (
          <span className="text-[13px]" style={{ color: C.dim }}>No cast data recorded.</span>
        )}
      </div>
    </div>
  )
}

export function MatchCasts({
  match,
  heroStats,
  abilityConst,
  itemConst,
}: {
  match: Match
  heroStats: HeroStat[]
  abilityConst: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const section = (players: MatchPlayer[], team: 'radiant' | 'dire') => (
    <div className="min-w-[480px] flex-1" style={{ background: C.panel }}>
      <div className="px-4 py-3 text-[15px] uppercase" style={{ color: team === 'radiant' ? C.green : C.red, letterSpacing: '2px', background: C.panelDark }}>
        {team === 'radiant' ? 'Radiant' : 'Dire'}
      </div>
      {players.map((p) => (
        <PlayerCasts key={p.player_slot} player={p} hero={heroMap.get(p.hero_id)} abilityConst={abilityConst} itemConst={itemConst} />
      ))}
    </div>
  )

  return (
    <div className="flex flex-wrap gap-4" style={{ fontFamily: 'var(--font-dota)' }}>
      {section(match.players.filter((p) => p.player_slot < 128), 'radiant')}
      {section(match.players.filter((p) => p.player_slot >= 128), 'dire')}
    </div>
  )
}
