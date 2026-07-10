import { Link } from '@tanstack/react-router'
import type { HeroStat, Match, MatchPlayer } from 'types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { orderedTeams } from './match_roster'

/* Combat tab — kill matrix, chronological kill log, and teamfight summary.
   Client palette shared with the other match views. */

const C = {
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

function fmtClock(sec: number): string {
  const neg = sec < 0
  const a = Math.abs(Math.floor(sec))
  return `${neg ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`
}

// linked=false for the one call site already nested inside a <Link> (the
// teamfight summary row), since an <a> can't nest inside another <a>.
function HeroIcon({
  hero,
  size = 28,
  linked = true,
}: {
  hero: HeroStat | undefined
  size?: number
  linked?: boolean
}) {
  if (!hero)
    return <span className="inline-block bg-slate-bg" style={{ width: size, height: size }} />
  const img = (
    <img
      src={heroIconUrl(hero.name)}
      alt={hero.localized_name}
      title={hero.localized_name}
      style={{ width: size, height: size }}
      onError={(e) => {
        const el = e.currentTarget
        el.onerror = null
        el.src = heroIconFromPath(hero.icon)
      }}
    />
  )
  if (!linked) return img
  return (
    <a href={`/hero/${heroSlug(hero.localized_name)}`} className="block shrink-0">
      {img}
    </a>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[15px] uppercase px-4 py-3 text-white font-dota"
      style={{ letterSpacing: '2px', background: C.panelDark }}
    >
      {children}
    </div>
  )
}

/* ---- Kill matrix: rows kill columns ---- */
function KillMatrix({ match, heroMap }: { match: Match; heroMap: Map<number, HeroStat> }) {
  const { radiant, dire } = orderedTeams(match)
  const all = [...radiant, ...dire]
  const killsOn = (p: MatchPlayer, victim: HeroStat | undefined) =>
    victim ? (p.killed?.[victim.name] ?? 0) : 0

  return (
    <div style={{ background: C.panel }}>
      <SectionTitle>Kill Matrix</SectionTitle>
      <div className="overflow-x-auto p-3">
        <Table className="w-auto border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="h-auto p-[3px]" />
              {all.map((v) => (
                <TableHead key={v.player_slot} className="h-auto p-[3px] text-center align-middle">
                  <HeroIcon hero={heroMap.get(v.hero_id)} size={36} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map((p) => {
              const isRadiant = p.player_slot < 128
              return (
                <TableRow key={p.player_slot} className="hover:bg-transparent border-none">
                  <TableCell className="p-[3px] pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block ${isRadiant ? 'bg-radiant' : 'bg-dire'}`}
                        style={{ width: 3, height: 30 }}
                      />
                      <HeroIcon hero={heroMap.get(p.hero_id)} size={36} />
                    </div>
                  </TableCell>
                  {all.map((v) => {
                    const sameTeam = v.player_slot < 128 === isRadiant
                    const n = sameTeam ? 0 : killsOn(p, heroMap.get(v.hero_id))
                    return (
                      <TableCell
                        key={v.player_slot}
                        className={`p-0 text-center align-middle tabular-nums font-dota ${n > 0 ? 'text-white' : 'text-slate-border'}`}
                        style={{
                          width: 44,
                          height: 40,
                          fontSize: 16,
                          background: sameTeam
                            ? 'rgba(255,255,255,0.02)'
                            : n > 0
                              ? `rgba(201,74,56,${Math.min(0.75, 0.12 + n * 0.09)})`
                              : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        {sameTeam ? '' : n || ''}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <div className="mt-2.5 text-[13px] text-slate-muted font-dota">Rows kill columns.</div>
      </div>
    </div>
  )
}

/* ---- Chronological kill log ---- */
function KillLogList({ match, heroMap }: { match: Match; heroMap: Map<number, HeroStat> }) {
  const heroByName = new Map([...heroMap.values()].map((h) => [h.name, h]))
  const events = match.players
    .flatMap((p) =>
      (p.kills_log ?? []).map((e) => ({
        time: e.time,
        killer: heroMap.get(p.hero_id),
        victim: heroByName.get(e.key),
        radiant: p.player_slot < 128,
      })),
    )
    .sort((a, b) => a.time - b.time)

  if (events.length === 0) return null

  return (
    <div style={{ background: C.panel }}>
      <SectionTitle>Kill Log</SectionTitle>
      <div
        className="p-4 grid gap-x-10 gap-y-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}
      >
        {events.map((e, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static event list
          <div key={i} className="flex items-center gap-2">
            <span className="w-14 text-right text-[14px] tabular-nums shrink-0 text-slate-muted font-dota">
              {fmtClock(e.time)}
            </span>
            <span
              className={e.radiant ? 'bg-radiant' : 'bg-dire'}
              style={{ width: 3, height: 24 }}
            />
            <HeroIcon hero={e.killer} size={30} />
            <span className="text-[13px] text-slate-muted">killed</span>
            <HeroIcon hero={e.victim} size={30} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---- Teamfights ---- */
function Teamfights({ match, heroMap }: { match: Match; heroMap: Map<number, HeroStat> }) {
  const fights = match.teamfights ?? []
  if (fights.length === 0) return null

  return (
    <div style={{ background: C.panel }}>
      <SectionTitle>Teamfights</SectionTitle>
      <div className="p-4 space-y-2.5">
        {fights.map((f, i) => {
          const radGold = f.players.reduce(
            (s, tp, idx) => s + ((match.players[idx]?.player_slot ?? 0) < 128 ? tp.gold_delta : 0),
            0,
          )
          const direGold = f.players.reduce(
            (s, tp, idx) => s + ((match.players[idx]?.player_slot ?? 0) < 128 ? 0 : tp.gold_delta),
            0,
          )
          const winner = radGold >= direGold ? 'radiant' : 'dire'
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static fight list
            <Link
              key={i}
              to="/match/$matchId/$tab"
              params={{ matchId: String(match.match_id), tab: 'replay' }}
              search={{ t: f.start }}
              className="flex items-center gap-5 px-4 py-3 hover:bg-white/[0.05] transition-colors"
              style={{ background: 'rgba(255,255,255,0.03)' }}
              title="Jump to this moment in the replay"
            >
              <div className="w-32 shrink-0 font-dota">
                <div className="text-[17px] tabular-nums text-white">
                  {fmtClock(f.start)} <span className="text-slate-muted">–</span> {fmtClock(f.end)}
                </div>
                <div
                  className="text-[12px] uppercase text-slate-muted"
                  style={{ letterSpacing: '1px' }}
                >
                  {f.deaths} deaths
                </div>
              </div>

              {/* participating heroes with damage + deaths */}
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {f.players.map((tp, idx) => {
                  const mp = match.players[idx]
                  const kills = Object.values(tp.killed ?? {}).reduce((s, n) => s + n, 0)
                  if (
                    !mp ||
                    (tp.damage === 0 && tp.deaths === 0 && kills === 0 && tp.gold_delta === 0)
                  )
                    return null
                  const hero = heroMap.get(mp.hero_id)
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: aligned to players order
                    <div
                      key={idx}
                      className="relative"
                      title={`${hero?.localized_name}: ${tp.damage.toLocaleString()} dmg, ${kills} kills${tp.deaths ? ', died' : ''}`}
                    >
                      <div
                        className={
                          mp.player_slot < 128
                            ? 'border-t-2 border-radiant'
                            : 'border-t-2 border-dire'
                        }
                        style={{ opacity: tp.deaths ? 0.45 : 1 }}
                      >
                        <HeroIcon hero={hero} size={42} linked={false} />
                      </div>
                      {tp.deaths > 0 && (
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[20px]"
                          style={{ color: '#ff6a5a' }}
                        >
                          ✕
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="w-48 shrink-0 text-right font-dota">
                <div
                  className={`text-[16px] tabular-nums ${winner === 'radiant' ? 'text-radiant' : 'text-dire'}`}
                >
                  {winner === 'radiant' ? 'Radiant' : 'Dire'} +
                  {Math.abs(radGold - direGold).toLocaleString()}{' '}
                  <span className="text-gold">gold</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export function MatchCombat({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const hasKilled = match.players.some((p) => Object.keys(p.killed ?? {}).length > 0)

  return (
    <div className="space-y-4">
      {hasKilled && <KillMatrix match={match} heroMap={heroMap} />}
      <Teamfights match={match} heroMap={heroMap} />
      <KillLogList match={match} heroMap={heroMap} />
    </div>
  )
}
