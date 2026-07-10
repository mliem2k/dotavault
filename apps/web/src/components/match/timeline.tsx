import type { HeroStat, Match } from 'types'
import { formatDuration, heroIconFromPath } from '@/lib/utils'

type TimelineEvent = {
  time: number
  kind: 'firstblood' | 'kill' | 'tower' | 'barracks' | 'roshan' | 'other'
  label: string
  team: 'radiant' | 'dire' | null
}

const OBJ_TYPE_MAP: Record<string, TimelineEvent['kind']> = {
  CHAT_MESSAGE_TOWER_KILL: 'tower',
  CHAT_MESSAGE_BARRACKS_KILL: 'barracks',
  CHAT_MESSAGE_ROSHAN_KILL: 'roshan',
  CHAT_MESSAGE_FIRSTBLOOD: 'firstblood',
}

const KIND_COLOR: Record<TimelineEvent['kind'], string> = {
  firstblood: 'text-yellow-400',
  kill: 'text-red-400',
  tower: 'text-orange-400',
  barracks: 'text-orange-600',
  roshan: 'text-purple-400',
  other: 'text-muted',
}

const KIND_ICON: Record<TimelineEvent['kind'], string> = {
  firstblood: '⚡',
  kill: '☠',
  tower: '🗼',
  barracks: '🏚',
  roshan: '🐉',
  other: '•',
}

function buildEvents(match: Match, heroMap: Map<number, HeroStat>): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const obj of match.objectives ?? []) {
    const kind = OBJ_TYPE_MAP[obj.type] ?? 'other'
    let label = obj.type.replace('CHAT_MESSAGE_', '').replace(/_/g, ' ').toLowerCase()
    let team: 'radiant' | 'dire' | null = null
    if (obj.team === 2) team = 'radiant'
    else if (obj.team === 3) team = 'dire'
    if (kind === 'firstblood') label = 'First Blood'
    else if (kind === 'tower') label = `${team ?? '?'} tower`
    else if (kind === 'barracks') label = `${team ?? '?'} barracks`
    else if (kind === 'roshan') label = 'Roshan killed'
    events.push({ time: obj.time, kind, label, team })
  }

  for (const player of match.players) {
    const hero = heroMap.get(player.hero_id)
    const heroName = hero?.localized_name ?? `Hero ${player.hero_id}`
    const isRadiant = player.player_slot < 128
    for (const kl of player.kills_log ?? []) {
      const killed = heroMap.get(0)?.localized_name ?? kl.key.replace('npc_dota_hero_', '')
      events.push({
        time: kl.time,
        kind: 'kill',
        label: `${heroName} killed ${kl.key.replace('npc_dota_hero_', '').replace(/_/g, ' ')}`,
        team: isRadiant ? 'radiant' : 'dire',
      })
    }
  }

  return events.sort((a, b) => a.time - b.time)
}

export function Timeline({
  match,
  heroStats,
  activeMinute,
  onMinuteChange,
}: {
  match: Match
  heroStats: HeroStat[]
  activeMinute: number
  onMinuteChange: (m: number) => void
}) {
  const durationMinutes = Math.floor(match.duration / 60)
  const goldAdv = match.radiant_gold_adv
  const xpAdv = match.radiant_xp_adv

  const goldAtMinute = goldAdv ? (goldAdv[activeMinute] ?? 0) : null
  const xpAtMinute = xpAdv ? (xpAdv[activeMinute] ?? 0) : null

  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const allEvents = buildEvents(match, heroMap)

  const windowStart = activeMinute * 60 - 30
  const windowEnd = activeMinute * 60 + 30
  const nearbyEvents = allEvents.filter((e) => e.time >= windowStart && e.time <= windowEnd)

  const maxAdv = goldAdv ? Math.max(...goldAdv.map(Math.abs), 1) : 1

  return (
    <div className="space-y-3 px-4 pb-4">
      <div className="flex items-center gap-3">
        <span className="w-14 font-mono text-sm text-accent">
          {formatDuration(activeMinute * 60)}
        </span>
        <input
          type="range"
          min={0}
          max={durationMinutes}
          value={activeMinute}
          onChange={(e) => onMinuteChange(Number(e.target.value))}
          className="flex-1 accent-accent cursor-pointer"
        />
        <span className="w-14 text-right font-mono text-xs text-muted">
          {formatDuration(match.duration)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {goldAtMinute !== null && (
          <div className="rounded border border-border bg-background p-3">
            <div className="mb-1.5 text-xs text-muted">Gold Advantage</div>
            <div
              className={`font-mono text-lg font-semibold ${goldAtMinute > 0 ? 'text-radiant' : goldAtMinute < 0 ? 'text-dire' : 'text-muted'}`}
            >
              {goldAtMinute > 0 ? '+' : ''}
              {goldAtMinute.toLocaleString()}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${goldAtMinute >= 0 ? 'bg-radiant' : 'bg-dire'}`}
                style={{
                  width: `${Math.min(100, (Math.abs(goldAtMinute) / maxAdv) * 100)}%`,
                  marginLeft: goldAtMinute < 0 ? 'auto' : undefined,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span className="text-radiant">Radiant</span>
              <span className="text-dire">Dire</span>
            </div>
          </div>
        )}
        {xpAtMinute !== null && (
          <div className="rounded border border-border bg-background p-3">
            <div className="mb-1.5 text-xs text-muted">XP Advantage</div>
            <div
              className={`font-mono text-lg font-semibold ${xpAtMinute > 0 ? 'text-radiant' : xpAtMinute < 0 ? 'text-dire' : 'text-muted'}`}
            >
              {xpAtMinute > 0 ? '+' : ''}
              {xpAtMinute.toLocaleString()}
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${xpAtMinute >= 0 ? 'bg-radiant' : 'bg-dire'}`}
                style={{
                  width: `${Math.min(100, (Math.abs(xpAtMinute) / maxAdv) * 100)}%`,
                  marginLeft: xpAtMinute < 0 ? 'auto' : undefined,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span className="text-radiant">Radiant</span>
              <span className="text-dire">Dire</span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-xs text-muted">
          Events near {formatDuration(activeMinute * 60)}
        </div>
        {nearbyEvents.length === 0 ? (
          <div className="text-xs text-muted italic">No events</div>
        ) : (
          <div className="max-h-36 space-y-0.5 overflow-y-auto">
            {nearbyEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-1 py-0.5">
                <span className="w-12 font-mono text-xs text-muted flex-shrink-0">
                  {formatDuration(ev.time)}
                </span>
                <span className={`text-sm ${KIND_COLOR[ev.kind]}`}>{KIND_ICON[ev.kind]}</span>
                <span className="text-xs capitalize">{ev.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
