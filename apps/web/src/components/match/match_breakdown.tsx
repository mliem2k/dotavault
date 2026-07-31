import { useMemo, useState } from 'react'
import type { AbilityConst, HeroStat, ItemConst, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { AbilityIcon } from './ability_icon'
import { ItemIcon } from './item_icon'
import { orderedTeams } from './match_roster'

/* Breakdown tab: one player's damage (or healing) as a source-by-hero
   matrix, laid out like Dota 2's own post-game breakdown screen. Rows are
   the abilities/items/attacks the player used, columns are the heroes on
   the receiving end, and clicking any cell opens a ranked breakdown of
   everything that landed on that hero.

   Parsed matches only: it reads damage_targets / healing_targets, which
   only our own replay parser produces. */

const C = {
  panel: 'rgba(12,11,14,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
  hairline: '#1c1810',
  border: '#24222a',
  gold: '#c9a94a',
  muted: '#8a8474',
  mutedDim: '#5a5648',
  damage: '#e8a070',
  healing: '#8fd6a8',
  kill: '#c94a38', // Dire red, the match-internal "side" variant per DESIGN.md
}

const SOURCE_W = 196
const COL_W = 84
const TOTAL_W = 92
const ROW_H = 40
const HEADER_H = 46
/* The expanded detail is a sparse list, so it gets the narrow tier from
   DESIGN.md's Narrow-Table Rule rather than stretching to the matrix's
   full width, which flattened small percentages into invisible slivers. */
const DETAIL_W = 780

type Kind = 'damage' | 'healing'

/* Plain attacks arrive under different keys depending on which parser
   produced the match: our own Go parser emits the raw combat-log name
   "dota_unknown", OpenDota emits "null", and kills_log omits the field
   entirely. All three mean "no ability or item, just an attack". */
const ATTACK_KEY = '__attack__'
function normSource(raw: string | undefined): string {
  return !raw || raw === 'null' || raw === 'dota_unknown' ? ATTACK_KEY : raw
}

/* The healing matrix adds two buckets that have no ability or item behind
   them, so they get a text badge instead of an icon (see the parser's
   handleHeal doc comment). */
const SYNTHETIC_LABELS: Record<string, string> = {
  [ATTACK_KEY]: 'Attacks',
  regen: 'HP Regen',
  lifesteal: 'Lifesteal',
}

function fmt(v: number): string {
  return v.toLocaleString()
}
function fmtK(v: number): string {
  return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString()
}

function sourceLabel(
  key: string,
  abilities: Record<string, AbilityConst>,
  itemConst: Record<string, ItemConst>,
): string {
  if (SYNTHETIC_LABELS[key]) return SYNTHETIC_LABELS[key]
  if (itemConst[key]?.dname) return itemConst[key].dname
  if (abilities[key]?.dname) return abilities[key].dname
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function SourceIcon({
  sourceKey,
  abilities,
  itemConst,
  size = 26,
}: {
  sourceKey: string
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
  size?: number
}) {
  if (sourceKey === ATTACK_KEY) {
    // Drawn rather than set as a "⚔" glyph: Radiance has no crossed-swords
    // character and substitutes a bare "×", which reads as a close button.
    return (
      <div
        className="shrink-0 flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: '#15181b',
          border: `1px solid ${C.border}`,
        }}
        title="Attacks"
      >
        <svg
          width={size * 0.62}
          height={size * 0.62}
          viewBox="0 0 16 16"
          fill="none"
          stroke={C.gold}
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <title>Attacks</title>
          <path d="M2.5 2.5 L10 10" />
          <path d="M13.5 2.5 L6 10" />
          <path d="M4.4 11.9 L6.6 14.1" />
          <path d="M11.6 11.9 L9.4 14.1" />
        </svg>
      </div>
    )
  }
  if (abilities[sourceKey]) {
    return (
      <AbilityIcon
        name={sourceKey}
        meta={abilities[sourceKey]}
        isTalent={false}
        level={0}
        size={size}
      />
    )
  }
  if (itemConst[sourceKey]) {
    return (
      <ItemIcon
        name={sourceKey}
        meta={itemConst[sourceKey]}
        width={Math.round(size * 1.33)}
        height={size}
      />
    )
  }
  return (
    <div
      className="shrink-0"
      style={{ width: size, height: size, background: '#15181b', border: `1px solid ${C.border}` }}
      title={sourceKey}
    />
  )
}

function HeroPortrait({ hero, size = 30 }: { hero: HeroStat | undefined; size?: number }) {
  if (!hero) return <span className="inline-block" style={{ width: size, height: size }} />
  return (
    <img
      src={heroIconUrl(hero.name)}
      alt={hero.localized_name}
      title={hero.localized_name}
      style={{ width: size, height: size }}
      onError={(e) => {
        const img = e.currentTarget
        img.onerror = null
        img.src = heroIconFromPath(hero.icon)
      }}
    />
  )
}

/* One horizontal bar row in the expanded cell detail. */
function BreakdownBar({
  sourceKey,
  value,
  pct,
  tint,
  highlighted,
  abilities,
  itemConst,
}: {
  sourceKey: string
  value: number
  pct: number
  tint: string
  highlighted: boolean
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  return (
    <div
      className="flex items-center gap-2"
      style={{
        padding: '3px 6px',
        background: highlighted ? 'rgba(201,169,74,0.10)' : undefined,
      }}
    >
      <SourceIcon sourceKey={sourceKey} abilities={abilities} itemConst={itemConst} size={22} />
      <span
        className="shrink-0 truncate text-[12px] font-dota"
        style={{ width: 132, color: highlighted ? C.gold : C.muted }}
        title={sourceLabel(sourceKey, abilities, itemConst)}
      >
        {sourceLabel(sourceKey, abilities, itemConst)}
      </span>
      <div className="min-w-0 flex-1" style={{ height: 8, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: tint }} />
      </div>
      <span
        className="shrink-0 text-right text-[11px] tabular-nums font-dota"
        style={{ width: 34, color: C.muted }}
      >
        {Math.round(pct)}%
      </span>
      <span
        className="shrink-0 text-right text-[12px] tabular-nums font-dota"
        style={{ width: 62, color: tint }}
      >
        {fmt(value)}
      </span>
    </div>
  )
}

export function MatchBreakdown({
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
  const { radiant, dire } = orderedTeams(match)
  const heroMap = useMemo(() => new Map(heroStats.map((h) => [h.id, h])), [heroStats])
  const heroByName = useMemo(() => new Map(heroStats.map((h) => [h.name, h])), [heroStats])

  const [slot, setSlot] = useState<number>(() => radiant[0]?.player_slot ?? 0)
  const [kind, setKind] = useState<Kind>('damage')
  const [cell, setCell] = useState<{ source: string; target: string } | null>(null)

  const player = match.players.find((p) => p.player_slot === slot) ?? match.players[0]

  const isParsed = match.players.some((p) => p.damage_targets != null || p.healing_targets != null)

  // Damage goes to the enemy team, healing goes to your own.
  const isRadiant = player.player_slot < 128
  const columnPlayers = useMemo(() => {
    if (kind === 'damage') return isRadiant ? dire : radiant
    return isRadiant ? radiant : dire
  }, [kind, isRadiant, radiant, dire])
  const columns = useMemo(
    () => columnPlayers.map((p) => heroMap.get(p.hero_id)).filter((h): h is HeroStat => !!h),
    [columnPlayers, heroMap],
  )
  const columnNames = useMemo(() => columns.map((h) => h.name), [columns])

  /* rows: source key -> per-hero totals, ranked.

     Totals deliberately count only the heroes shown as columns, not every
     target the source ever touched. damage_targets also carries creeps,
     towers and Roshan, so summing all of them produced a TOTAL that didn't
     add up to its own row (Attacks read 2,736 across the five heroes but
     56,175 overall) and floated pure jungle/lasthit sources like Hand of
     Midas and Devour to the top of a hero-damage table with no hero damage
     at all. Sources with no hero damage are dropped for the same reason. */
  const rows = useMemo(() => {
    const raw = (kind === 'damage' ? player.damage_targets : player.healing_targets) ?? {}
    const merged = new Map<string, Record<string, number>>()
    for (const [rawKey, targets] of Object.entries(raw)) {
      const key = normSource(rawKey)
      const into = merged.get(key) ?? {}
      for (const [hero, v] of Object.entries(targets)) into[hero] = (into[hero] ?? 0) + v
      merged.set(key, into)
    }
    return [...merged.entries()]
      .map(([key, targets]) => ({
        key,
        targets,
        total: columnNames.reduce((s, n) => s + (targets[n] ?? 0), 0),
      }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [player, kind, columnNames])

  // Kills per (source, hero), so a damage cell can carry a skull count the
  // way Dota's own breakdown does. kills_log omits inflictor for a plain
  // attack, which normSource folds into the attacks row.
  const killsByCell = useMemo(() => {
    const m = new Map<string, number>()
    if (kind !== 'damage') return m
    for (const k of player.kills_log ?? []) {
      const id = `${normSource(k.inflictor)}|${k.key}`
      m.set(id, (m.get(id) ?? 0) + 1)
    }
    return m
  }, [player, kind])

  const tint = kind === 'damage' ? C.damage : C.healing
  const columnTotals = columns.map((h) => rows.reduce((s, r) => s + (r.targets[h.name] ?? 0), 0))
  const grandTotal = columnTotals.reduce((s, v) => s + v, 0)

  if (!isParsed) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm font-dota" style={{ color: C.muted }}>
          This match is unparsed, so the per-source breakdown is unavailable.
        </span>
      </div>
    )
  }

  // Expanded detail: everything that landed on the selected hero, ranked.
  const detail = (() => {
    if (!cell) return null
    const hero = heroByName.get(cell.target)
    const entries = rows
      .map((r) => ({ key: r.key, value: r.targets[cell.target] ?? 0 }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
    const total = entries.reduce((s, e) => s + e.value, 0)
    return { hero, entries, total }
  })()

  const selectPlayer = (nextSlot: number) => {
    setSlot(nextSlot)
    setCell(null)
  }

  return (
    <div className="space-y-3">
      {/* Player selector, Radiant then Dire */}
      <div className="flex flex-wrap items-center gap-1">
        {[...radiant, ...dire].map((p, i) => {
          const hero = heroMap.get(p.hero_id)
          const active = p.player_slot === player.player_slot
          return (
            <div key={p.player_slot} className="flex items-center">
              {i === radiant.length && (
                <span
                  className="mx-2 inline-block"
                  style={{ width: 1, height: 24, background: C.border }}
                />
              )}
              <button
                type="button"
                onClick={() => selectPlayer(p.player_slot)}
                title={hero?.localized_name}
                className="flex items-center justify-center"
                style={{
                  padding: 3,
                  background: active ? 'rgba(201,169,74,0.14)' : 'transparent',
                  borderBottom: `2px solid ${active ? C.gold : 'transparent'}`,
                }}
              >
                <HeroPortrait hero={hero} size={active ? 36 : 30} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Damage / Healing switch */}
      <div className="flex gap-1" style={{ maxWidth: 320 }}>
        {(['damage', 'healing'] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k)
              setCell(null)
            }}
            className="flex-1 px-3 py-2 text-[11px] font-bold uppercase font-dota"
            style={{
              letterSpacing: '1px',
              background: kind === k ? C.gold : '#15181b',
              color: kind === k ? '#0b0b0d' : C.muted,
              border: `1px solid ${kind === k ? C.gold : C.border}`,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: SOURCE_W + columns.length * COL_W + TOTAL_W }}>
            {/* Column header: the heroes on the receiving end */}
            <div
              className="flex items-stretch"
              style={{ background: C.panelDark, borderBottom: `1px solid ${C.border}` }}
            >
              <div
                className="flex shrink-0 items-center gap-2"
                style={{ width: SOURCE_W, height: HEADER_H, padding: '0 10px' }}
              >
                <HeroPortrait hero={heroMap.get(player.hero_id)} size={30} />
                <span
                  className="text-[13px] font-bold uppercase font-dota"
                  style={{ letterSpacing: '2px', color: tint }}
                >
                  {kind}
                </span>
              </div>
              {columns.map((h) => (
                <div
                  key={h.id}
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: COL_W, height: HEADER_H }}
                >
                  <HeroPortrait hero={h} size={30} />
                </div>
              ))}
              <div
                className="flex shrink-0 items-center justify-center text-[10px] font-bold uppercase font-dota"
                style={{ width: TOTAL_W, height: HEADER_H, letterSpacing: '1px', color: C.muted }}
              >
                Total
              </div>
            </div>

            {rows.length === 0 && (
              <div
                className="flex items-center px-3 text-[12px] font-dota"
                style={{ height: ROW_H, color: C.muted }}
              >
                No {kind} recorded for this player.
              </div>
            )}

            {rows.map((row) => {
              const rowSelected = cell?.source === row.key
              return (
                <div key={row.key}>
                  <div
                    className="flex items-stretch"
                    style={{ borderTop: `1px solid ${C.hairline}` }}
                  >
                    <div
                      className="flex shrink-0 items-center gap-2"
                      style={{ width: SOURCE_W, height: ROW_H, padding: '0 10px' }}
                    >
                      <SourceIcon sourceKey={row.key} abilities={abilities} itemConst={itemConst} />
                      <span
                        className="truncate text-[12px] font-dota"
                        style={{ color: '#dcd6c8' }}
                        title={sourceLabel(row.key, abilities, itemConst)}
                      >
                        {sourceLabel(row.key, abilities, itemConst)}
                      </span>
                    </div>

                    {columns.map((h) => {
                      const value = row.targets[h.name] ?? 0
                      const kills = killsByCell.get(`${row.key}|${h.name}`) ?? 0
                      const selected = rowSelected && cell?.target === h.name
                      return (
                        <button
                          key={h.id}
                          type="button"
                          disabled={value === 0}
                          onClick={() =>
                            setCell(selected ? null : { source: row.key, target: h.name })
                          }
                          className="relative flex shrink-0 flex-col items-center justify-center"
                          style={{
                            width: COL_W,
                            height: ROW_H,
                            background: selected ? 'rgba(201,169,74,0.12)' : undefined,
                            border: `1px solid ${selected ? C.gold : 'transparent'}`,
                            cursor: value === 0 ? 'default' : 'pointer',
                          }}
                        >
                          <span
                            className="text-[13px] tabular-nums font-dota"
                            style={{ color: value > 0 ? tint : C.mutedDim }}
                          >
                            {value > 0 ? fmtK(value) : '-'}
                          </span>
                          {kills > 0 && (
                            // Dota's own breakdown puts a skull here, but
                            // Radiance has no skull glyph and renders tofu,
                            // so the count is tinted Dire red instead.
                            <span
                              className="text-[9px] font-bold tabular-nums font-dota"
                              style={{ color: C.kill, letterSpacing: '0.5px' }}
                              title={`${kills} kill${kills > 1 ? 's' : ''} on this hero with this`}
                            >
                              {kills} KILL{kills > 1 ? 'S' : ''}
                            </span>
                          )}
                        </button>
                      )
                    })}

                    <div
                      className="flex shrink-0 items-center justify-center"
                      style={{ width: TOTAL_W, height: ROW_H }}
                    >
                      <span
                        className="text-[13px] font-bold tabular-nums font-dota"
                        style={{ color: '#dcd6c8' }}
                      >
                        {fmt(row.total)}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail, anchored under the selected row */}
                  {rowSelected && detail && (
                    <div
                      style={{
                        background: 'rgba(8,10,12,0.86)',
                        borderTop: `1px solid ${C.border}`,
                        borderBottom: `1px solid ${C.border}`,
                        padding: '10px 12px',
                      }}
                    >
                      <div className="mb-2 flex items-center gap-2" style={{ maxWidth: DETAIL_W }}>
                        <span
                          className="text-[11px] font-bold uppercase font-dota"
                          style={{ letterSpacing: '1.5px', color: C.muted }}
                        >
                          All {kind} into
                        </span>
                        <HeroPortrait hero={detail.hero} size={22} />
                        <span
                          className="text-[12px] font-bold uppercase font-dota"
                          style={{ letterSpacing: '1px', color: '#dcd6c8' }}
                        >
                          {detail.hero?.localized_name ??
                            cell?.target.replace('npc_dota_hero_', '')}
                        </span>
                        <span
                          className="ml-auto text-[13px] tabular-nums font-dota"
                          style={{ color: tint }}
                        >
                          {fmt(detail.total)}
                        </span>
                      </div>
                      <div className="space-y-0.5" style={{ maxWidth: DETAIL_W }}>
                        {detail.entries.map((e) => (
                          <BreakdownBar
                            key={e.key}
                            sourceKey={e.key}
                            value={e.value}
                            pct={detail.total > 0 ? (e.value / detail.total) * 100 : 0}
                            tint={tint}
                            highlighted={e.key === cell?.source}
                            abilities={abilities}
                            itemConst={itemConst}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Column totals */}
            {rows.length > 0 && (
              <div
                className="flex items-stretch"
                style={{ borderTop: `1px solid ${C.border}`, background: C.panelDark }}
              >
                <div
                  className="flex shrink-0 items-center text-[10px] font-bold uppercase font-dota"
                  style={{
                    width: SOURCE_W,
                    height: ROW_H,
                    padding: '0 10px',
                    letterSpacing: '1px',
                    color: C.muted,
                  }}
                >
                  Total
                </div>
                {columns.map((h, i) => (
                  <div
                    key={h.id}
                    className="flex shrink-0 items-center justify-center"
                    style={{ width: COL_W, height: ROW_H }}
                  >
                    <span
                      className="text-[13px] tabular-nums font-dota"
                      style={{ color: columnTotals[i] > 0 ? '#dcd6c8' : C.mutedDim }}
                    >
                      {columnTotals[i] > 0 ? fmtK(columnTotals[i]) : '-'}
                    </span>
                  </div>
                ))}
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: TOTAL_W, height: ROW_H }}
                >
                  <span
                    className="text-[13px] font-bold tabular-nums font-dota"
                    style={{ color: tint }}
                  >
                    {fmt(grandTotal)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] font-dota" style={{ color: C.mutedDim }}>
        Click any cell to break down everything that landed on that hero.
      </p>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}
      >
        <AllyContributionPanel player={player} abilities={abilities} itemConst={itemConst} />
        <DispelsPanel player={player} abilities={abilities} itemConst={itemConst} />
      </div>
    </div>
  )
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div
        className="text-[11px] font-bold uppercase font-dota"
        style={{
          letterSpacing: '2px',
          color: C.muted,
          background: C.panelDark,
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {title}
      </div>
      <div style={{ padding: '10px 12px' }}>{children}</div>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] font-dota" style={{ color: C.mutedDim }}>
      {children}
    </span>
  )
}

/* Ally Damage Contribution is a PROXY: total physical damage allies dealt
   to a target while this player's armor debuff was active on it, which is
   not the same as damage the debuff caused. Labelled as such rather than
   presented as a precise figure (see the parser's
   combatlog_ally_contribution.go). */
function AllyContributionPanel({
  player,
  abilities,
  itemConst,
}: {
  player: MatchPlayer
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const entries = Object.entries(player.ally_damage_contribution ?? {}).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 0

  return (
    <PanelShell title="Ally Damage Contribution">
      {entries.length === 0 ? (
        <EmptyNote>No armor debuffs applied by this player.</EmptyNote>
      ) : (
        <>
          <div className="space-y-1">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <SourceIcon sourceKey={key} abilities={abilities} itemConst={itemConst} size={22} />
                <span
                  className="shrink-0 truncate text-[12px] font-dota"
                  style={{ width: 118, color: C.muted }}
                  title={sourceLabel(key, abilities, itemConst)}
                >
                  {sourceLabel(key, abilities, itemConst)}
                </span>
                <div
                  className="min-w-0 flex-1"
                  style={{ height: 8, background: 'rgba(255,255,255,0.05)' }}
                >
                  <div
                    style={{
                      width: `${max > 0 ? Math.max((value / max) * 100, 2) : 0}%`,
                      height: '100%',
                      background: C.damage,
                    }}
                  />
                </div>
                <span
                  className="shrink-0 text-right text-[12px] tabular-nums font-dota"
                  style={{ width: 64, color: C.damage }}
                >
                  {fmt(value)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-dota" style={{ color: C.mutedDim }}>
            Estimate: ally damage dealt while the debuff was active, not damage the debuff caused.
          </p>
        </>
      )}
    </PanelShell>
  )
}

/* Dispels, grouped by what was removed rather than by the ability that did
   the removing, since "you stripped 8.8s of Ink Trail" is the more useful
   read. Duration is the remaining time the purge cut short. */
function DispelsPanel({
  player,
  abilities,
  itemConst,
}: {
  player: MatchPlayer
  abilities: Record<string, AbilityConst>
  itemConst: Record<string, ItemConst>
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; seconds: number }>()
    for (const d of player.dispels_log ?? []) {
      const prev = m.get(d.modifier) ?? { count: 0, seconds: 0 }
      m.set(d.modifier, {
        count: prev.count + 1,
        seconds: prev.seconds + Math.max(d.duration, 0),
      })
    }
    return [...m.entries()].sort((a, b) => b[1].seconds - a[1].seconds)
  }, [player])

  const totalCount = grouped.reduce((s, [, v]) => s + v.count, 0)

  return (
    <PanelShell title={`Dispels${totalCount > 0 ? ` (${totalCount})` : ''}`}>
      {grouped.length === 0 ? (
        <EmptyNote>No dispels by this player.</EmptyNote>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-2">
          {grouped.map(([modifier, v]) => (
            <div
              key={modifier}
              className="flex w-[54px] flex-col items-center gap-0.5"
              title={`${sourceLabel(modifier, abilities, itemConst)}: dispelled ${v.count}x, ${v.seconds.toFixed(1)}s of remaining duration removed`}
            >
              <div className="relative">
                <SourceIcon
                  sourceKey={modifier}
                  abilities={abilities}
                  itemConst={itemConst}
                  size={30}
                />
                {v.count > 1 && (
                  <span
                    className="absolute text-[9px] font-bold tabular-nums font-dota"
                    style={{
                      right: -2,
                      bottom: -2,
                      padding: '0 2px',
                      background: '#0b0b0d',
                      border: `1px solid ${C.border}`,
                      color: C.gold,
                    }}
                  >
                    {v.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] tabular-nums font-dota" style={{ color: C.kill }}>
                -{v.seconds.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  )
}
