import type { HeroStat, Match, MatchPlayer } from 'types'
import { heroIconFromPath, heroIconUrl } from '@/lib/utils'

export const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

export const ROW_H = 54
export const TEAM_HEADER_H = 34

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

/* Player identity block — hero portrait + name + level + hero name.
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
  const rank = rankLabel(player.rank_tier)

  const heroImg = hero ? (
    <img
      src={heroIconUrl(hero.name)}
      alt={hero.localized_name}
      className="rounded object-cover"
      style={{ width: 40, height: 40 }}
      onError={(e) => {
        const img = e.currentTarget
        img.onerror = null
        img.src = heroIconFromPath(hero.icon)
      }}
    />
  ) : (
    <div className="rounded" style={{ width: 40, height: 40, background: '#161310' }} />
  )

  return (
    <div
      className="flex items-center gap-2.5 shrink-0"
      style={{ width, height: ROW_H, padding: '0 10px', background: active ? '#241f16' : 'transparent' }}
    >
      {hero && !linkless ? (
        <a href={`/hero/${heroShort}`} className="shrink-0 hover:ring-1 hover:ring-white/40 rounded">
          {heroImg}
        </a>
      ) : (
        <div className="shrink-0">{heroImg}</div>
      )}

      <div className="min-w-0 flex-1 text-left">
        {accountId && !linkless ? (
          <a
            href={`/player/${accountId}`}
            className="block text-[14px] font-semibold truncate hover:underline leading-tight"
            style={{ color: '#ece6d8', fontFamily: 'var(--font-dota)' }}
          >
            {playerName}
          </a>
        ) : (
          <span
            className="block text-[14px] font-semibold truncate leading-tight"
            style={{ color: accountId ? '#ece6d8' : '#a8a08c', fontFamily: 'var(--font-dota)' }}
          >
            {playerName}
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-flex items-center justify-center text-[9px] font-bold rounded-full shrink-0"
            style={{ width: 15, height: 15, background: '#2a2620', color: '#c9a94a', fontFamily: 'var(--font-dota)' }}
          >
            {player.level}
          </span>
          {hero &&
            (linkless ? (
              <span
                className="text-[10px] uppercase tracking-wider truncate"
                style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
              >
                {hero.localized_name}
              </span>
            ) : (
              <a
                href={`/hero/${heroShort}`}
                className="text-[10px] uppercase tracking-wider truncate hover:underline"
                style={{ color: '#8a8474', fontFamily: 'var(--font-dota)' }}
              >
                {hero.localized_name}
              </a>
            ))}
          {rank && (
            <span className="text-[9px] shrink-0" style={{ color: '#5a5446', fontFamily: 'var(--font-dota)' }}>
              · {rank}
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
  const color = isRadiant ? '#8ec63f' : '#d14a38'
  const name = isRadiant ? 'The Radiant' : 'The Dire'
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{ width, height: TEAM_HEADER_H, padding: '0 10px', borderLeft: `3px solid ${color}`, background: `${color}12` }}
    >
      <span className="text-[14px] font-bold" style={{ color, fontFamily: 'var(--font-dota)' }}>
        {name}
      </span>
      <span className="text-[11px] uppercase tracking-wide" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>
        Score: <span style={{ color }}>{score}</span>
      </span>
      {isWinner && (
        <span
          className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ml-auto"
          style={{ background: '#123010', color: '#8ec63f', border: '1px solid #8ec63f44' }}
        >
          Winner
        </span>
      )}
    </div>
  )
}

/* Standalone roster sidebar for the Graphs tab.
   When `interactive` is set, each row toggles that player's series on/off and
   shows a line-color chip so the sidebar doubles as the chart legend. */
export function MatchRosterSidebar({
  match,
  heroStats,
  width = 232,
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
  const radKills = radiant.reduce((s, p) => s + p.kills, 0)
  const direKills = dire.reduce((s, p) => s + p.kills, 0)

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
          style={{ borderBottom: '1px solid #1c1810', opacity: on ? 1 : 0.4 }}
        >
          {chip}
          {identity}
        </button>
      )
    }
    return (
      <div key={p.player_slot} className="flex items-center" style={{ borderBottom: '1px solid #1c1810' }}>
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
    <div className="shrink-0" style={{ width }}>
      {section(radiant, true)}
      <div style={{ height: 8 }} />
      {section(dire, false)}
    </div>
  )
}
