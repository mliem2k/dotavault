import { useMemo } from 'react'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { formatDuration, heroIconFromPath, heroIconUrl, heroSlug } from '@/lib/utils'
import { formatClock } from './match_time'

/* Story tab (OpenDota-style): a readable narrative recap generated from the
   match data: opening kills, lane outcomes, momentum swings, the decisive
   fight, and the closing push. */

const C = {
  dim: '#67757f',
  text: '#cfd4d8',
  white: '#ffffff',
  green: '#9fbf3f',
  red: '#c94a38',
  gold: '#f2c94c',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
}

type Paragraph = { time: number | null; text: string; heroId?: number }

function heroName(heroMap: Map<number, HeroStat>, p: MatchPlayer | undefined): string {
  if (!p) return 'someone'
  return heroMap.get(p.hero_id)?.localized_name ?? 'a hero'
}

function buildStory(match: Match, heroStats: HeroStat[]): Paragraph[] {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const heroByName = new Map(heroStats.map((h) => [h.name, h]))
  const paras: Paragraph[] = []
  const winner = match.radiant_win ? 'Radiant' : 'Dire'
  const loser = match.radiant_win ? 'Dire' : 'Radiant'
  const score = `${match.radiant_score}–${match.dire_score}`.replace('–', ' to ')

  // Headline
  const adv = match.radiant_gold_adv ?? []
  const winnerWorstDeficit = adv.length
    ? match.radiant_win
      ? Math.min(...adv)
      : -Math.max(...adv)
    : 0
  const comeback = winnerWorstDeficit <= -10000
  paras.push({
    time: null,
    text: comeback
      ? `The ${winner} won ${score} after ${formatDuration(match.duration)}, clawing back from a ${Math.round(Math.abs(winnerWorstDeficit) / 1000)}k gold deficit in a genuine comeback.`
      : `The ${winner} took this one ${score} in ${formatDuration(match.duration)}, closing out over the ${loser}.`,
  })

  // First blood
  const fbEvent = (match.objectives ?? []).find((o) => o.type === 'CHAT_MESSAGE_FIRSTBLOOD')
  if (fbEvent?.player_slot != null) {
    const fbPlayer = match.players.find((p) => p.player_slot === fbEvent.player_slot)
    paras.push({
      time: fbEvent.time,
      text: `First blood went to ${heroName(heroMap, fbPlayer)} at ${formatClock(Math.max(0, fbEvent.time))}.`,
      heroId: fbPlayer?.hero_id,
    })
  }

  // Lane phase summary from NW+XP at 10
  const at10 = (p: MatchPlayer) => (p.gold_t?.[10] ?? 0) + (p.xp_t?.[10] ?? 0)
  if (match.players.some((p) => (p.gold_t?.length ?? 0) > 10)) {
    const radLane = match.players
      .filter((p) => p.player_slot < 128)
      .reduce((s, p) => s + at10(p), 0)
    const direLane = match.players
      .filter((p) => p.player_slot >= 128)
      .reduce((s, p) => s + at10(p), 0)
    const ratio = direLane > 0 ? radLane / direLane : 1
    paras.push({
      time: 600,
      text:
        ratio > 1.08
          ? 'The laning phase belonged to the Radiant, who came out of the first ten minutes with a clear resource lead.'
          : ratio < 0.92
            ? 'The laning phase belonged to the Dire, who came out of the first ten minutes with a clear resource lead.'
            : 'The laning phase resolved close to even, with neither side buying much breathing room by the ten minute mark.',
    })
  }

  // Biggest teamfight
  const fights = match.teamfights ?? []
  if (fights.length) {
    const biggest = [...fights].sort((a, b) => b.deaths - a.deaths)[0]
    const swing = biggest.players.reduce(
      (s, tp, idx) => s + (match.players[idx].player_slot < 128 ? tp.gold_delta : -tp.gold_delta),
      0,
    )
    const swingTeam = swing >= 0 ? 'Radiant' : 'Dire'
    paras.push({
      time: biggest.start,
      text: `The bloodiest fight broke out at ${formatClock(biggest.start)}: ${biggest.deaths} heroes died, and the ${swingTeam} came away ${Math.abs(Math.round(swing / 100) / 10)}k gold richer for it.`,
    })
  }

  // Roshan
  const roshKills = (match.objectives ?? []).filter((o) => o.type === 'CHAT_MESSAGE_ROSHAN_KILL')
  for (const rk of roshKills.slice(0, 3)) {
    const team = rk.team === 2 ? 'Radiant' : 'Dire'
    paras.push({ time: rk.time, text: `The ${team} claimed Roshan at ${formatClock(rk.time)}.` })
  }

  // Top performer on the winning side
  const winners = match.players.filter((p) => p.player_slot < 128 === match.radiant_win)
  const mvp = [...winners].sort(
    (a, b) =>
      b.kills +
      b.assists * 0.5 +
      b.net_worth / 3000 -
      (a.kills + a.assists * 0.5 + a.net_worth / 3000),
  )[0]
  if (mvp) {
    paras.push({
      time: null,
      text: `${heroName(heroMap, mvp)} anchored the ${winner} with ${mvp.kills}/${mvp.deaths}/${mvp.assists} and ${(mvp.net_worth / 1000).toFixed(1)}k net worth.`,
      heroId: mvp.hero_id,
    })
  }

  // Closing: last building event or generic
  const lastKill = [...(match.objectives ?? [])].filter((o) => o.type === 'building_kill').pop()
  if (lastKill) {
    const side = lastKill.key?.includes('goodguys') ? 'Radiant' : 'Dire'
    paras.push({
      time: lastKill.time,
      text: `The final structure fell on the ${side} side at ${formatClock(lastKill.time)}, and the ${winner} called game shortly after.`,
    })
  }

  // Kill leaders footnote
  const killLeader = [...match.players].sort((a, b) => b.kills - a.kills)[0]
  if (killLeader) {
    const kl = heroByName.get(heroMap.get(killLeader.hero_id)?.name ?? '')
    void kl
    paras.push({
      time: null,
      text: `${heroName(heroMap, killLeader)} finished as the match's top killer with ${killLeader.kills}.`,
      heroId: killLeader.hero_id,
    })
  }

  return paras.sort((a, b) => (a.time ?? -1) - (b.time ?? -1))
}

export function MatchStory({ match, heroStats }: { match: Match; heroStats: HeroStat[] }) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const paras = useMemo(() => buildStory(match, heroStats), [match, heroStats])

  return (
    <div className="mx-auto max-w-[760px] font-dota" style={{ background: C.panel }}>
      <div
        className="px-5 py-3 text-[15px] uppercase text-white"
        style={{ letterSpacing: '2px', background: C.panelDark }}
      >
        Match Story
      </div>
      <div className="space-y-4 px-6 py-5">
        {paras.map((p, i) => {
          const hero = p.heroId != null ? heroMap.get(p.heroId) : undefined
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static narrative
            <div key={i} className="flex items-start gap-3">
              <span className="w-12 shrink-0 pt-0.5 text-right text-[12px] tabular-nums text-slate-muted">
                {p.time != null ? formatClock(Math.max(0, p.time)) : ''}
              </span>
              {hero ? (
                <a
                  href={`/hero/${heroSlug(hero.localized_name)}`}
                  className="mt-0.5 shrink-0 block"
                >
                  <img
                    src={heroIconUrl(hero.name)}
                    alt=""
                    style={{ width: 24, height: 24 }}
                    onError={(e) => {
                      const img = e.currentTarget
                      img.onerror = null
                      img.src = heroIconFromPath(hero.icon)
                    }}
                  />
                </a>
              ) : (
                <span style={{ width: 24 }} className="shrink-0" />
              )}
              <p className="text-[15px] leading-relaxed text-slate-foreground">{p.text}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
