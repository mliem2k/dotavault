import type { ChatMessage, HeroStat, MatchPlayer } from 'types'
import { formatDuration, heroIconUrl } from '@/lib/utils'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

const CHATWHEEL_LABELS: Record<string, string> = {
  chatwheel_safe: 'Safe!',
  chatwheel_missing: 'Missing!',
  chatwheel_stun: 'Stun them!',
  chatwheel_get_back: 'Get back!',
  chatwheel_need_wards: 'Need wards!',
  chatwheel_push_mid: 'Push mid!',
  chatwheel_good_game: 'Good game!',
  chatwheel_well_played: 'Well played!',
  chatwheel_gg: 'gg',
  chatwheel_lol: 'lol',
}

export function MatchChat({
  chat,
  players,
  heroStats,
}: {
  chat: ChatMessage[]
  players: MatchPlayer[]
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const playerBySlot = new Map(players.map((p) => [p.player_slot, p]))

  const messages = chat.filter((m) => m.type === 'chat' || m.type === 'chatwheel' || m.type === 'say_team')

  if (messages.length === 0) {
    return <p className="px-4 pb-4 text-xs text-muted">No chat messages recorded for this match.</p>
  }

  return (
    <div className="divide-y divide-border/30 max-h-[400px] overflow-y-auto">
      {messages.map((msg, i) => {
        const player = playerBySlot.get(msg.player_slot)
        const hero = player ? heroMap.get(player.hero_id) : undefined
        const color = PLAYER_COLORS[msg.player_slot] ?? '#888'
        const isTeam = msg.type === 'say_team'
        const text = CHATWHEEL_LABELS[msg.key] ?? msg.key

        return (
          <div key={i} className="flex items-start gap-2 px-4 py-1.5">
            <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted pt-0.5">
              {formatDuration(msg.time)}
            </span>
            {hero && (
              <img
                src={heroIconUrl(hero.name)}
                alt=""
                className="mt-0.5 h-5 w-5 shrink-0 rounded-sm"
                style={{ border: `1px solid ${color}40` }}
              />
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-medium" style={{ color }}>
                {player?.personaname ?? player?.name ?? hero?.localized_name ?? `Player ${msg.player_slot}`}
              </span>
              {isTeam && (
                <span className="ml-1 text-[10px] text-muted">(team)</span>
              )}
              <span className="ml-2 text-xs text-foreground/80 break-words">{text}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
