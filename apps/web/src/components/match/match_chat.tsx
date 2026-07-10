import type { ChatMessage, HeroStat, MatchPlayer } from 'types'
import { formatDuration, heroIconFromPath, heroIconUrl } from '@/lib/utils'
import { PlayerNameLink } from './match_roster'

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF',
  1: '#66FFBF',
  2: '#BF00BF',
  3: '#F3F00B',
  4: '#FF6600',
  128: '#FE87C4',
  129: '#A1B477',
  130: '#65D9F7',
  131: '#007A00',
  132: '#A46900',
}

const C = {
  dim: '#67757f',
  text: '#e8ecef',
  white: '#ffffff',
  panel: 'rgba(16,19,22,0.72)',
  panelDark: 'rgba(8,10,12,0.7)',
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

type ChatWheelEntry = { id: number; name?: string; message?: string; label?: string }

// "MissingHero" → "Missing hero", "Game_Is_Hard" → "Game is hard"
function prettifyWheelName(name: string): string {
  const words = name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
  return words.map((w, i) => (i === 0 ? w : w.toLowerCase())).join(' ')
}

export function MatchChat({
  chat,
  players,
  heroStats,
  chatWheel = {},
}: {
  chat: ChatMessage[]
  players: MatchPlayer[]
  heroStats: HeroStat[]
  chatWheel?: Record<string, ChatWheelEntry>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const playerBySlot = new Map(players.map((p) => [p.player_slot, p]))

  const messages = chat.filter(
    (m) => m.type === 'chat' || m.type === 'chatwheel' || m.type === 'say_team',
  )

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-slate-muted font-dota">
          No chat messages recorded for this match.
        </span>
      </div>
    )
  }

  return (
    <div className="max-w-[980px] mx-auto font-dota" style={{ background: C.panel }}>
      <div
        className="text-[15px] uppercase px-4 py-3 text-white"
        style={{ letterSpacing: '2px', background: C.panelDark }}
      >
        Chat
      </div>
      <div className="px-4 py-2">
        {messages.map((msg, i) => {
          const player = playerBySlot.get(msg.player_slot)
          const hero = player ? heroMap.get(player.hero_id) : undefined
          const color = PLAYER_COLORS[msg.player_slot] ?? '#888'
          const isTeam = msg.type === 'say_team'
          const isWheel = msg.type === 'chatwheel'
          const wheelEntry = isWheel ? chatWheel[msg.key] : undefined
          const wheelText =
            wheelEntry?.message && !wheelEntry.message.startsWith('dota_chatwheel')
              ? wheelEntry.message
              : wheelEntry?.name
                ? prettifyWheelName(wheelEntry.name)
                : undefined
          const text = wheelText ?? CHATWHEEL_LABELS[msg.key] ?? msg.key

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static message list
              key={i}
              className="flex items-center gap-3 py-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="w-14 shrink-0 text-right text-[14px] tabular-nums text-slate-muted">
                {formatDuration(Math.max(0, msg.time))}
              </span>
              {hero && (
                <img
                  src={heroIconUrl(hero.name)}
                  alt=""
                  className="shrink-0"
                  style={{ width: 32, height: 32, borderLeft: `3px solid ${color}` }}
                  onError={(e) => {
                    const img = e.currentTarget
                    img.onerror = null
                    img.src = heroIconFromPath(hero.icon)
                  }}
                />
              )}
              {player ? (
                <PlayerNameLink
                  player={player}
                  className="shrink-0 text-[15px] font-semibold"
                  style={{ color }}
                />
              ) : (
                <span className="shrink-0 text-[15px] font-semibold" style={{ color }}>
                  {hero?.localized_name ?? `Player ${msg.player_slot}`}
                </span>
              )}
              {isTeam && (
                <span
                  className="shrink-0 text-[11px] uppercase px-1.5 py-0.5 text-slate-muted border-slate-card"
                  style={{ border: '1px solid', letterSpacing: '1px' }}
                >
                  Team
                </span>
              )}
              {isWheel && (
                <span
                  className="shrink-0 text-[11px] uppercase px-1.5 py-0.5 text-slate-muted border-slate-card"
                  style={{ border: '1px solid', letterSpacing: '1px' }}
                >
                  Wheel
                </span>
              )}
              <span className="min-w-0 text-[16px] break-words text-slate-foreground-light">
                {text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
