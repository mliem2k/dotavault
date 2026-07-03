import type { HeroStat, Match, MatchPlayer } from 'types'
import { cdnFallback, heroIconFromPath, heroLandscapeCdn, heroLandscapeUrl } from '@/lib/utils'

export const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

export const ROW_H = 62
export const TEAM_HEADER_H = 58

// Cumulative XP required to reach each level (index = level - 1).
export const XP_TABLE = [
  0, 230, 600, 1080, 1680, 2300, 2940, 3600, 4280, 5080, 5900, 6740, 7640, 8865,
  10115, 11390, 12690, 14015, 15415, 16905, 18405, 20155, 22155, 24405, 26905,
  29305, 32305, 35805, 39805, 44305,
]

export function levelFromXp(xp: number): number {
  let lvl = 1
  for (let i = 0; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) lvl = i + 1
    else break
  }
  return lvl
}

export function rankLabel(tier: number | null | undefined): string {
  if (!tier) return ''
  const level = Math.floor(tier / 10)
  const stars = tier % 10
  const names = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal']
  const name = names[level] ?? ''
  return level < 8 && stars ? `${name} ${stars}` : name
}

export function orderedTeams(match: Match): { radiant: MatchPlayer[]; dire: MatchPlayer[] } {
  return {
    radiant: match.players.filter((p) => p.player_slot < 128),
    dire: match.players.filter((p) => p.player_slot >= 128),
  }
}

/* Player identity block — avatar placeholder + hero portrait + name + level + hero name.
   Shared by the scoreboard rows and the graphs roster sidebar so both align. */
export function PlayerIdentityCell({
  player,
  hero,
  width,
  active = false,
  linkless = false,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  width: number
  active?: boolean
  // When true, render plain text instead of anchors — used inside a clickable
  // toggle row where nested <a> elements would be invalid / conflict.
  linkless?: boolean
}) {
  const playerName = player.personaname ?? player.name ?? 'Anonymous'
  const accountId = player.account_id
  const heroShort = hero?.name.replace('npc_dota_hero_', '') ?? ''

  const heroImg = hero ? (
    <img
      src={heroLandscapeUrl(hero.name)}
      alt={hero.localized_name}
      className="object-cover"
      style={{ width: 82, height: 46 }}
      onError={cdnFallback(heroLandscapeCdn(hero.name))}
    />
  ) : (
    <div style={{ width: 82, height: 46, background: '#14181b' }} />
  )

  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{
        width,
        height: ROW_H,
        padding: '0 8px',
        background: active ? 'rgba(216,222,227,0.92)' : 'transparent',
        boxShadow: active ? 'inset 3px 0 0 #ffffff' : undefined,
      }}
    >
      {/* Steam avatar placeholder (match payloads carry no avatar URL) */}
      <div
        className="shrink-0 flex items-center justify-center"
        style={{ width: 44, height: 44, background: active ? '#2c3236' : '#20262a', border: '1px solid #2c3236' }}
      >
        <span className="text-[20px]" style={{ color: '#67757f', fontFamily: 'var(--font-dota)' }}>?</span>
      </div>

      {hero && !linkless ? (
        <a href={`/hero/${heroShort}`} className="shrink-0 hover:brightness-125">
          {heroImg}
        </a>
      ) : (
        <div className="shrink-0">{heroImg}</div>
      )}

      <div className="min-w-0 flex-1 text-left" style={{ fontFamily: 'var(--font-dota)' }}>
        {accountId && !linkless ? (
          <a
            href={`/player/${accountId}`}
            className="block text-[15px] truncate hover:underline leading-tight"
            style={{ color: active ? '#14181b' : '#ffffff' }}
          >
            {playerName}
          </a>
        ) : (
          <span
            className="block text-[15px] truncate leading-tight"
            style={{ color: active ? '#14181b' : accountId ? '#ffffff' : '#c3cbd1' }}
          >
            {playerName}
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-flex items-center justify-center text-[10px] rounded-full shrink-0 tabular-nums"
            style={{
              width: 17,
              height: 17,
              border: `1px solid ${active ? '#4a5258' : '#4a5258'}`,
              color: active ? '#3c444a' : '#8a97a0',
            }}
          >
            {player.level}
          </span>
          {hero && (
            <span
              className="text-[11px] uppercase truncate"
              style={{ color: active ? '#3c444a' : '#8a97a0', letterSpacing: '1px' }}
            >
              {hero.localized_name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function TeamHeader({
  isRadiant,
  score,
  isWinner,
  width,
}: {
  isRadiant: boolean
  score: number
  isWinner: boolean
  width: number
}) {
  const color = isRadiant ? '#9fbf3f' : '#c94a38'
  const name = isRadiant ? 'The Radiant' : 'The Dire'
  return (
    <div
      className="flex items-center gap-3 shrink-0"
      style={{ width, height: TEAM_HEADER_H, padding: '0 10px', background: 'rgba(10,12,14,0.75)', fontFamily: 'var(--font-dota)' }}
    >
      <div className="min-w-0">
        <div className="text-[20px] leading-tight truncate" style={{ color, textShadow: `0 0 10px ${color}44` }}>
          {name}
        </div>
        <div className="text-[11px] uppercase leading-tight" style={{ color: '#67757f', letterSpacing: '1px' }}>
          Score: <span className="text-[13px]" style={{ color: '#ffffff' }}>{score}</span>
        </div>
      </div>
      {isWinner && (
        <span
          className="text-[10px] uppercase px-2 py-0.5 ml-auto shrink-0"
          style={{ background: '#d8dee3', color: '#14181b', letterSpacing: '2px', transform: 'skewX(-12deg)' }}
        >
          Winner
        </span>
      )}
    </div>
  )
}

/* Standalone roster sidebar for the Scoreboard / Graphs tabs.
   When `interactive` is set, each row toggles that player's series on/off and
   shows a line-color chip so the sidebar doubles as the chart legend. */
export function MatchRosterSidebar({
  match,
  heroStats,
  width = 264,
  selectedSlot,
  interactive = false,
  visibleSlots,
  onToggle,
  showColors = false,
}: {
  match: Match
  heroStats: HeroStat[]
  width?: number
  selectedSlot?: number | null
  interactive?: boolean
  visibleSlots?: Set<number>
  onToggle?: (slot: number) => void
  showColors?: boolean
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)
  const radKills = match.radiant_score ?? radiant.reduce((s, p) => s + p.kills, 0)
  const direKills = match.dire_score ?? dire.reduce((s, p) => s + p.kills, 0)

  const row = (p: MatchPlayer) => {
    const color = PLAYER_COLORS[p.player_slot] ?? '#888'
    const on = !visibleSlots || visibleSlots.has(p.player_slot)
    const chip = showColors ? (
      <span
        className="shrink-0 rounded-sm"
        style={{ width: 10, height: 10, marginLeft: 8, background: on ? color : 'transparent', border: `2px solid ${color}` }}
      />
    ) : null
    const identity = (
      <PlayerIdentityCell
        player={p}
        hero={heroMap.get(p.hero_id)}
        width={width - (showColors ? 18 : 0)}
        active={selectedSlot === p.player_slot}
        linkless={interactive}
      />
    )

    if (interactive) {
      return (
        <button
          key={p.player_slot}
          type="button"
          onClick={() => onToggle?.(p.player_slot)}
          className="flex items-center w-full transition-opacity hover:bg-white/[0.03]"
          style={{ boxShadow: 'inset 0 -1px 0 #1b2023', opacity: on ? 1 : 0.4 }}
        >
          {chip}
          {identity}
        </button>
      )
    }
    return (
      <div key={p.player_slot} className="flex items-center" style={{ boxShadow: 'inset 0 -1px 0 #1b2023' }}>
        {chip}
        {identity}
      </div>
    )
  }

  const section = (players: MatchPlayer[], isRadiant: boolean) => (
    <div>
      <TeamHeader
        isRadiant={isRadiant}
        score={isRadiant ? radKills : direKills}
        isWinner={isRadiant ? match.radiant_win : !match.radiant_win}
        width={width}
      />
      {players.map(row)}
    </div>
  )

  return (
    <div className="shrink-0" style={{ width, background: 'rgba(16,19,22,0.72)' }}>
      {section(radiant, true)}
      {section(dire, false)}
    </div>
  )
}
