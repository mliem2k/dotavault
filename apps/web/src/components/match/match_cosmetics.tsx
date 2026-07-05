import type { HeroStat, Match } from 'types'
import { playerColor } from '@/lib/dotaconst'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

/* Cosmetics tab (OpenDota-style): the equipped cosmetic items each player
   brought into the match, when the API recorded any. */

const C = {
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

const RARITY_COLORS: Record<string, string> = {
  common: '#b0c3d9',
  uncommon: '#5e98d9',
  rare: '#4b69ff',
  mythical: '#8847ff',
  legendary: '#d32ce6',
  immortal: '#e4ae39',
  arcana: '#ade55c',
  ancient: '#eb4b4b',
}

export function MatchCosmetics({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const withItems = match.players.filter((p) => (p.cosmetics?.length ?? 0) > 0)

  return (
    <div style={{ background: C.panel, fontFamily: 'var(--font-dota)' }}>
      <div className="px-4 py-3 text-[15px] uppercase" style={{ color: C.white, letterSpacing: '2px', background: C.panelDark }}>
        Cosmetics
      </div>
      {withItems.map((p) => {
        const hero = heroMap.get(p.hero_id)
        return (
          <div key={p.player_slot} className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span style={{ width: 3, height: 22, background: playerColor(p.player_slot) }} />
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
              <span className="text-[13px]" style={{ color: p.player_slot < 128 ? C.green : C.red }}>
                {hero?.localized_name ?? 'Unknown'}
              </span>
              <span className="truncate text-[12px]" style={{ color: C.dim }}>{p.personaname ?? 'Anonymous'}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(p.cosmetics ?? []).map((c) => (
                <div
                  key={c.item_id}
                  className="flex items-center gap-1.5 px-2 py-1"
                  style={{
                    background: 'rgba(8,10,12,0.6)',
                    border: `1px solid ${RARITY_COLORS[c.item_rarity ?? ''] ?? '#22282c'}`,
                  }}
                  title={c.item_rarity ?? undefined}
                >
                  {c.image_path && (
                    <img
                      src={`https://steamcdn-a.akamaihd.net/apps/570/${c.image_path}`}
                      alt=""
                      style={{ width: 44, height: 30, objectFit: 'contain' }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                  <span className="text-[12px]" style={{ color: RARITY_COLORS[c.item_rarity ?? ''] ?? C.text }}>
                    {c.name ?? `Item ${c.item_id}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {withItems.length === 0 && (
        <div className="py-10 text-center text-[13px]" style={{ color: C.dim }}>
          No cosmetic data recorded for this match.
        </div>
      )}
    </div>
  )
}
