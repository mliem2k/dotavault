import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { HeroStat, Match, MatchPlayer } from 'types'
import { opendota } from '@/lib/opendota'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl, heroSlug } from '@/lib/utils'

export const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

export const ROW_H = 62
export const TEAM_HEADER_H = 58

/* Fit the 12-row roster (2 team headers + 10 players) into the viewport:
   measures where the attached element starts and sizes rows so the whole
   block ends just above the bottom edge. Row heights are clamped so rows
   stay usable on short windows and never exceed the design size. */
export function useRosterMetrics(reserve = 36): {
  ref: React.RefObject<HTMLDivElement | null>
  rowH: number
  headerH: number
  rosterH: number
} {
  const ref = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(ROW_H)
  useEffect(() => {
    const compute = () => {
      const el = ref.current
      if (!el) return
      // Reserve the page's bottom padding plus any fixed UI below the roster.
      const avail = window.innerHeight - el.getBoundingClientRect().top - window.scrollY - reserve
      // 10 rows + 2 headers, header = row - 4  →  total = 12·row − 8
      const fit = Math.floor((avail + 8) / 12)
      setRowH(Math.max(36, Math.min(ROW_H, fit)))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [reserve])
  const headerH = rowH - 4
  return { ref, rowH, headerH, rosterH: 2 * headerH + 10 * rowH }
}

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

/* Profile lookup for a match player. Match payloads omit the avatar (and
   sometimes the persona name) even when the account id is public, so we pull
   both from the player's OpenDota profile. Players with no account id are
   fully anonymized upstream — there is nothing to resolve for them. */
export function usePlayerProfile(accountId: number | null | undefined) {
  return useQuery({
    queryKey: ['player_profile', accountId],
    queryFn: () => opendota.player(String(accountId)),
    enabled: accountId != null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  })
}

/* Display name for a match player, falling back to the fetched profile. */
export function usePlayerName(player: MatchPlayer): string {
  const profile = usePlayerProfile(player.account_id)
  return (
    player.personaname ?? player.name ?? profile.data?.profile?.personaname ?? 'Anonymous'
  )
}

/* Pro nickname for a match player, when it differs from their persona name
   (same [name] convention the player profile page uses). */
export function usePlayerProName(player: MatchPlayer, personaName: string): string | undefined {
  const proPlayers = useQuery({
    queryKey: ['pro_players'],
    queryFn: () => opendota.proPlayers(),
    enabled: !!player.account_id,
    staleTime: 60 * 60 * 1000,
  })
  const pro = proPlayers.data?.find((p) => p.account_id === player.account_id && p.is_pro)
  return pro?.name && pro.name !== personaName ? pro.name : undefined
}

/* Player name that links to their profile page when the account is public,
   with their pro nickname shown alongside when it differs. */
export function PlayerNameLink({
  player,
  className,
  style,
}: {
  player: MatchPlayer
  className?: string
  style?: React.CSSProperties
}) {
  const name = usePlayerName(player)
  const proName = usePlayerProName(player, name)
  const content = (
    <>
      {name}
      {proName && (
        <span className="ml-1 opacity-70" style={{ fontSize: '0.85em' }}>
          [{proName}]
        </span>
      )}
    </>
  )
  if (player.account_id) {
    return (
      <a
        href={`/player/${player.account_id}`}
        className={`${className ?? ''} hover:underline`}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </a>
    )
  }
  return (
    <span className={className} style={style}>
      {content}
    </span>
  )
}

/* Steam avatar for a match player; anonymous players keep the "?" placeholder
   like the client. */
export function PlayerAvatar({
  accountId,
  active,
  size,
}: {
  accountId: number | null | undefined
  active: boolean
  size: number
}) {
  const profile = usePlayerProfile(accountId)
  const url = profile.data?.profile?.avatarfull

  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="shrink-0 object-cover"
        style={{ width: size, height: size, border: '1px solid #2c3236' }}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <div
      className="shrink-0 flex items-center justify-center"
      style={{ width: size, height: size, background: active ? '#2c3236' : '#20262a', border: '1px solid #2c3236' }}
    >
      <span style={{ fontSize: size * 0.45, color: '#67757f', fontFamily: 'var(--font-dota)' }}>?</span>
    </div>
  )
}

/* Player identity block — avatar + hero portrait + name + level + hero name.
   Shared by the scoreboard rows and the graphs roster sidebar so both align.
   All internal sizes derive from `rowH` so the roster can shrink to fit. */
export function PlayerIdentityCell({
  player,
  hero,
  width,
  active = false,
  linkless = false,
  rowH = ROW_H,
  levelOverride,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  width: number
  active?: boolean
  // When true, render plain text instead of anchors — used inside a clickable
  // toggle row where nested <a> elements would be invalid / conflict.
  linkless?: boolean
  rowH?: number
  levelOverride?: number
}) {
  const accountId = player.account_id
  const playerName = usePlayerName(player)
  const proName = usePlayerProName(player, playerName)
  const heroShort = hero ? heroSlug(hero.localized_name) : ''
  const small = rowH < 54
  const avatarSize = Math.min(44, rowH - 14)
  const heroH = Math.min(46, rowH - 12)
  const heroW = Math.round(heroH * (82 / 46))

  const heroImg = hero ? (
    <img
      src={heroLandscapeUrl(hero.name)}
      alt={hero.localized_name}
      className="object-cover"
      style={{ width: heroW, height: heroH }}
      onError={cdnFallback(heroLandscapeCdn(hero.name))}
    />
  ) : (
    <div style={{ width: heroW, height: heroH, background: '#14181b' }} />
  )

  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{
        width,
        height: rowH,
        padding: '0 8px',
        background: active ? 'rgba(216,222,227,0.92)' : 'transparent',
        boxShadow: active ? 'inset 3px 0 0 #ffffff' : undefined,
      }}
    >
      <PlayerAvatar accountId={accountId} active={active} size={avatarSize} />

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
            className={`block ${small ? 'text-[13px]' : 'text-[15px]'} truncate hover:underline leading-tight`}
            style={{ color: active ? '#14181b' : '#ffffff' }}
          >
            {playerName}
            {proName && <span className="opacity-70"> [{proName}]</span>}
          </a>
        ) : (
          <span
            className={`block ${small ? 'text-[13px]' : 'text-[15px]'} truncate leading-tight`}
            style={{ color: active ? '#14181b' : accountId ? '#ffffff' : '#c3cbd1' }}
          >
            {playerName}
            {proName && <span className="opacity-70"> [{proName}]</span>}
          </span>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="inline-flex items-center justify-center rounded-full shrink-0 tabular-nums"
            style={{
              width: small ? 14 : 17,
              height: small ? 14 : 17,
              fontSize: small ? 9 : 10,
              border: '1px solid #4a5258',
              color: active ? '#3c444a' : '#8a97a0',
            }}
          >
            {levelOverride ?? player.level}
          </span>
          {hero && (
            <span
              className={`${small ? 'text-[10px]' : 'text-[11px]'} uppercase truncate`}
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
  headerH = TEAM_HEADER_H,
}: {
  isRadiant: boolean
  score: number
  isWinner: boolean
  width: number
  headerH?: number
}) {
  const color = isRadiant ? '#9fbf3f' : '#c94a38'
  const name = isRadiant ? 'The Radiant' : 'The Dire'
  const small = headerH < 50
  return (
    <div
      className="flex items-center gap-3 shrink-0"
      style={{
        width,
        height: headerH,
        padding: '0 10px',
        background: 'rgba(10,12,14,0.75)',
        fontFamily: 'var(--font-dota)',
      }}
    >
      {small ? (
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-[16px] leading-tight truncate" style={{ color, textShadow: `0 0 10px ${color}44` }}>
            {name}
          </span>
          <span className="text-[10px] uppercase leading-tight" style={{ color: '#67757f', letterSpacing: '1px' }}>
            Score: <span className="text-[12px]" style={{ color: '#ffffff' }}>{score}</span>
          </span>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="text-[20px] leading-tight truncate" style={{ color, textShadow: `0 0 10px ${color}44` }}>
            {name}
          </div>
          <div className="text-[11px] uppercase leading-tight" style={{ color: '#67757f', letterSpacing: '1px' }}>
            Score: <span className="text-[13px]" style={{ color: '#ffffff' }}>{score}</span>
          </div>
        </div>
      )}
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
  rowH = ROW_H,
  headerH = TEAM_HEADER_H,
  scoreRadiant,
  scoreDire,
  levels,
}: {
  match: Match
  heroStats: HeroStat[]
  width?: number
  selectedSlot?: number | null
  interactive?: boolean
  visibleSlots?: Set<number>
  onToggle?: (slot: number) => void
  showColors?: boolean
  rowH?: number
  headerH?: number
  scoreRadiant?: number
  scoreDire?: number
  levels?: Map<number, number>
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const { radiant, dire } = orderedTeams(match)
  const radKills = scoreRadiant ?? match.radiant_score ?? radiant.reduce((s, p) => s + p.kills, 0)
  const direKills = scoreDire ?? match.dire_score ?? dire.reduce((s, p) => s + p.kills, 0)

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
        rowH={rowH}
        levelOverride={levels?.get(p.player_slot)}
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
        headerH={headerH}
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
