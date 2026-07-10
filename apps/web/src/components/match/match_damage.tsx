import { useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { AbilityIcon } from './ability_icon'
import { ItemIcon } from './item_icon'
import { orderedTeams, PlayerIdentityCell, ROW_H, TEAM_HEADER_H } from './match_roster'

const IDENTITY_W = 236
const HERO_COL_W = 76
const TOTAL_W = 84

type Mode = 'dealt' | 'taken' | 'sources' | 'abilities'
const MODE_LABELS: Record<Mode, string> = {
  dealt: 'Damage Dealt',
  taken: 'Damage Taken',
  sources: 'Damage Sources',
  abilities: 'By Ability',
}

function fmtK(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
}

/* ---- Hero-vs-hero matrix cell with heatmap intensity ---- */
function MatrixCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{
        width: HERO_COL_W,
        height: ROW_H,
        background:
          value > 0 ? `rgba(226,75,58,${(0.06 + intensity * 0.5).toFixed(2)})` : 'transparent',
      }}
    >
      <span
        className={`text-[13px] tabular-nums font-dota ${value > 0 ? (intensity > 0.55 ? 'text-white' : '') : 'text-slate-border'}`}
        style={{
          color: value > 0 && intensity <= 0.55 ? '#e8c0a0' : undefined,
          fontWeight: intensity > 0.55 ? 700 : 400,
        }}
      >
        {value > 0 ? fmtK(value) : '—'}
      </span>
    </div>
  )
}

/* ---- Damage sources for one player ---- */
function SourcesRow({
  player,
  abilities,
  itemConst,
}: {
  player: MatchPlayer
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const inflictors = Object.entries(player.damage_inflictor ?? {})
    .filter(([k]) => k !== 'null' && k !== '')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  const attacks = player.damage_inflictor?.null ?? 0
  const total = Object.values(player.damage_inflictor ?? {}).reduce((s, v) => s + v, 0) || 1

  const chip = (icon: React.ReactNode, value: number, key: string) => (
    <div key={key} className="flex items-center gap-1 shrink-0">
      {icon}
      <span className="text-[12px] tabular-nums font-dota" style={{ color: '#e8c0a0' }}>
        {fmtK(value)}
      </span>
      <span className="text-[10px] tabular-nums font-dota text-slate-muted">
        {Math.round((value / total) * 100)}%
      </span>
    </div>
  )

  return (
    <div className="flex items-center gap-3 px-3" style={{ height: ROW_H, minWidth: 640 }}>
      {attacks > 0 &&
        chip(
          <div
            className="shrink-0 rounded-sm flex items-center justify-center border-slate-bg"
            style={{
              width: 26,
              height: 26,
              background: '#15181b',
              borderWidth: 1,
              borderStyle: 'solid',
              color: '#a89060',
              fontSize: 13,
            }}
            title="Attacks"
          >
            ⚔
          </div>,
          attacks,
          'attacks',
        )}
      {inflictors.map(([key, value]) => {
        if (abilities[key])
          return chip(
            <AbilityIcon name={key} meta={abilities[key]} isTalent={false} level={0} />,
            value,
            key,
          )
        if (itemConst[key])
          return chip(
            <ItemIcon name={key} meta={itemConst[key]} width={26} height={26} />,
            value,
            key,
          )
        return chip(
          <div
            className="shrink-0 rounded-sm border-slate-bg"
            style={{
              width: 26,
              height: 26,
              background: '#15181b',
              borderWidth: 1,
              borderStyle: 'solid',
            }}
            title={key}
          />,
          value,
          key,
        )
      })}
    </div>
  )
}

/* Stratz Focus-style drill-down: for each damage source (ability, item, or
   plain attacks), how much went into each enemy hero (damage_targets). */
function AbilityTargetsRow({
  player,
  heroStats,
  abilities,
  itemConst,
}: {
  player: MatchPlayer
  heroStats: HeroStat[]
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const heroByName = new Map(heroStats.map((h) => [h.name, h]))
  const sources = Object.entries(player.damage_targets ?? {}).sort(
    (a, b) =>
      Object.values(b[1]).reduce((s, v) => s + v, 0) -
      Object.values(a[1]).reduce((s, v) => s + v, 0),
  )
  const label = (raw: string): string => {
    if (raw === 'null') return 'Attacks'
    if (raw.startsWith('item_'))
      return itemConst[raw.slice(5)]?.dname ?? raw.slice(5).replace(/_/g, ' ')
    return abilities[raw]?.dname ?? raw.replace(/_/g, ' ')
  }
  if (sources.length === 0) {
    return (
      <div className="flex items-center px-3 text-[12px] font-dota text-slate-muted">
        No per-target damage data.
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-1.5">
      {sources.slice(0, 4).map(([srcName, targets]) => {
        const total = Object.values(targets).reduce((s, v) => s + v, 0)
        return (
          <div key={srcName} className="flex items-center gap-2 text-[11px] font-dota">
            <span
              className="w-[120px] shrink-0 truncate"
              style={{ color: '#a8b0b6' }}
              title={label(srcName)}
            >
              {label(srcName)}
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums" style={{ color: '#e8a070' }}>
              {fmtK(total)}
            </span>
            <div className="flex min-w-0 flex-wrap gap-1">
              {Object.entries(targets)
                .sort((a, b) => b[1] - a[1])
                .map(([victim, dmg]) => {
                  const hero = heroByName.get(victim)
                  return (
                    <span
                      key={victim}
                      className="inline-flex items-center gap-1 px-1 border-slate-bg"
                      style={{
                        background: 'rgba(8,10,12,0.6)',
                        borderWidth: 1,
                        borderStyle: 'solid',
                      }}
                      title={`${hero?.localized_name ?? victim}: ${dmg.toLocaleString()}`}
                    >
                      {hero && (
                        <img
                          src={heroIconUrl(hero.name)}
                          alt=""
                          style={{ width: 16, height: 16 }}
                          onError={(e) => {
                            const img = e.currentTarget
                            img.onerror = null
                            img.src = heroIconFromPath(hero.icon)
                          }}
                        />
                      )}
                      <span className="tabular-nums text-slate-foreground">{fmtK(dmg)}</span>
                    </span>
                  )
                })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MatchDamage({
  match,
  heroStats,
  abilities,
  itemConst,
}: {
  match: Match
  heroStats: HeroStat[]
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const [mode, setMode] = useState<Mode>('dealt')
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)

  const isParsed = match.players.some((p) => p.damage != null || p.damage_inflictor != null)
  if (!isParsed) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm font-dota text-slate-muted">
          This match is unparsed — damage data unavailable.
        </span>
      </div>
    )
  }

  // Global max for heatmap scaling across both matrices.
  const matrixMax = Math.max(
    1,
    ...match.players.flatMap((p) => {
      const src = mode === 'taken' ? p.damage_taken : p.damage
      return Object.entries(src ?? {})
        .filter(([k]) => k.startsWith('npc_dota_hero_'))
        .map(([, v]) => v)
    }),
  )

  const teamSection = (players: MatchPlayer[], isRadiant: boolean) => {
    const color = isRadiant ? '#9fbf3f' : '#c94a38'
    const enemies = (isRadiant ? dire : radiant)
      .map((e) => heroMap.get(e.hero_id))
      .filter((h): h is HeroStat => !!h)
    const kills = players.reduce((s, p) => s + p.kills, 0)
    const isWinner = isRadiant ? match.radiant_win : !match.radiant_win

    return (
      <div style={{ background: '#101316', border: '1px solid #1f2529' }}>
        {/* Header band */}
        <div className="flex items-stretch border-b border-slate-bg">
          <div
            className="flex items-center gap-2 shrink-0"
            style={{
              width: IDENTITY_W,
              height: TEAM_HEADER_H,
              padding: '0 10px',
              borderLeft: `3px solid ${color}`,
              background: `${color}12`,
            }}
          >
            <span
              className={`text-[14px] font-bold font-dota ${isRadiant ? 'text-radiant' : 'text-dire'}`}
            >
              {isRadiant ? 'The Radiant' : 'The Dire'}
            </span>
            <span className="text-[11px] uppercase tracking-wide font-dota text-slate-muted">
              Score: <span className={isRadiant ? 'text-radiant' : 'text-dire'}>{kills}</span>
            </span>
            {isWinner && (
              <span
                className="text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ml-auto text-radiant"
                style={{ background: '#123010', border: '1px solid #9fbf3f44' }}
              >
                Winner
              </span>
            )}
          </div>

          {mode === 'sources' || mode === 'abilities' ? (
            <div className="flex items-center px-3 text-[10px] font-bold uppercase tracking-wider font-dota text-slate-muted">
              {mode === 'sources'
                ? 'Top damage sources (share of total)'
                : 'Damage per ability, per enemy hero'}
            </div>
          ) : (
            <>
              {enemies.map((h) => (
                <div
                  key={h.id}
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: HERO_COL_W, height: TEAM_HEADER_H }}
                >
                  <img
                    src={heroIconUrl(h.name)}
                    alt={h.localized_name}
                    title={h.localized_name}
                    className="rounded"
                    style={{ width: 28, height: 28 }}
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      img.src = heroIconFromPath(h.icon)
                    }}
                  />
                </div>
              ))}
              <div
                className="shrink-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider font-dota text-slate-muted"
                style={{ width: TOTAL_W, height: TEAM_HEADER_H }}
              >
                Total
              </div>
            </>
          )}
        </div>

        {/* Rows */}
        {players.map((p) => {
          const src = mode === 'taken' ? p.damage_taken : p.damage
          const cells = enemies.map((h) => src?.[h.name] ?? 0)
          const total = cells.reduce((s, v) => s + v, 0)
          return (
            <div
              key={p.player_slot}
              className="flex items-stretch"
              style={{ borderBottom: '1px solid #1f2529' }}
            >
              <PlayerIdentityCell player={p} hero={heroMap.get(p.hero_id)} width={IDENTITY_W} />
              {mode === 'sources' ? (
                <SourcesRow player={p} abilities={abilities} itemConst={itemConst} />
              ) : mode === 'abilities' ? (
                <AbilityTargetsRow
                  player={p}
                  heroStats={heroStats}
                  abilities={abilities}
                  itemConst={itemConst}
                />
              ) : (
                <>
                  {cells.map((v, i) => (
                    <MatrixCell key={enemies[i].id} value={v} max={matrixMax} />
                  ))}
                  <div
                    className="shrink-0 flex items-center justify-center"
                    style={{ width: TOTAL_W, height: ROW_H }}
                  >
                    <span
                      className="text-[14px] font-bold tabular-nums font-dota"
                      style={{ color: '#e8a070' }}
                    >
                      {fmtK(total)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: IDENTITY_W + 5 * HERO_COL_W + TOTAL_W }}>
        {/* Mode toggle */}
        <div className="flex gap-1 mb-3" style={{ maxWidth: 460 }}>
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-sm font-dota border ${mode === m ? 'text-slate-foreground-light bg-slate-card border-slate-border' : 'text-slate-muted-light border-slate-bg'}`}
              style={{ background: mode === m ? undefined : '#15181b' }}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {teamSection(radiant, true)}
          {teamSection(dire, false)}
        </div>
      </div>
    </div>
  )
}
