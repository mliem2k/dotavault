import type { HeroStat, Match, MatchPlayer } from 'types'

function heroLgUrl(heroName: string): string {
  const short = heroName.replace('npc_dota_hero_', '')
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${short}_lg.png`
}

function fmtK(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
}

const PLAYER_COLORS: Record<number, string> = {
  0: '#3375FF', 1: '#66FFBF', 2: '#BF00BF', 3: '#F3F00B', 4: '#FF6600',
  128: '#FE87C4', 129: '#A1B477', 130: '#65D9F7', 131: '#007A00', 132: '#A46900',
}

function HeroPortraitCard({
  player,
  hero,
  isRadiant,
}: {
  player: MatchPlayer
  hero: HeroStat | undefined
  isRadiant: boolean
}) {
  const teamColor = isRadiant ? '#92c93a' : '#c23c2a'
  const slotColor = PLAYER_COLORS[player.player_slot] ?? '#888'
  const playerName = player.personaname ?? player.name ?? 'Anonymous'
  const accountId = player.account_id

  return (
    <div
      className="relative overflow-hidden shrink-0 flex flex-col"
      style={{ width: '128px', height: '320px', background: '#06101a' }}
    >
      {/* Team color top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 h-[3px]" style={{ background: teamColor }} />

      {/* Player slot color left bar */}
      <div className="absolute top-[3px] left-0 bottom-0 z-10 w-[2px]" style={{ background: slotColor }} />

      {/* Hero image — landscape cropped to portrait */}
      {hero ? (
        <img
          src={heroLgUrl(hero.name)}
          alt={hero.localized_name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center top' }}
          onError={(e) => {
            const img = e.target as HTMLImageElement
            const short = hero.name.replace('npc_dota_hero_', '')
            img.src = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/heroes/${short}_sb.png`
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#0a1828]" />
      )}

      {/* Vignette overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 50%, rgba(0,0,0,0.7) 80%, rgba(0,0,0,0.92) 100%)' }}
      />

      {/* Player name — top */}
      <div className="absolute top-1.5 left-1 right-1 z-20">
        {accountId ? (
          <a
            href={`/player/${accountId}`}
            className="block text-[11px] font-semibold truncate leading-tight hover:underline"
            style={{ color: '#fff', fontFamily: 'var(--font-dota)', letterSpacing: '0.02em' }}
          >
            {playerName}
          </a>
        ) : (
          <span
            className="block text-[11px] font-semibold truncate leading-tight"
            style={{ color: '#c8d6e5', fontFamily: 'var(--font-dota)', letterSpacing: '0.02em' }}
          >
            {playerName}
          </span>
        )}
      </div>

      {/* Hero name */}
      {hero && (
        <div className="absolute z-20" style={{ top: '24px', left: '4px', right: '4px' }}>
          <a
            href={`/hero/${hero.name.replace('npc_dota_hero_', '')}`}
            className="text-[9px] uppercase tracking-widest truncate block hover:underline"
            style={{ color: slotColor, fontFamily: 'var(--font-dota)' }}
          >
            {hero.localized_name}
          </a>
        </div>
      )}

      {/* Bottom stats overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-1.5 pb-1.5 pt-6">
        {/* Net worth */}
        <div className="flex items-center gap-1 mb-1">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
            <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">$</text>
          </svg>
          <span
            className="text-[13px] font-bold leading-none tabular-nums"
            style={{ color: '#e8a832', fontFamily: 'var(--font-dota)' }}
          >
            {fmtK(player.net_worth)}
          </span>
        </div>

        {/* K / D / A */}
        <div
          className="text-[13px] font-semibold tabular-nums leading-none"
          style={{ fontFamily: 'var(--font-dota)' }}
        >
          <span style={{ color: '#57c262' }}>{player.kills}</span>
          <span style={{ color: '#3a5a6a' }}> / </span>
          <span style={{ color: '#e84747' }}>{player.deaths}</span>
          <span style={{ color: '#3a5a6a' }}> / </span>
          <span style={{ color: '#c8d6e5' }}>{player.assists}</span>
        </div>
      </div>
    </div>
  )
}

export function MatchOverview({
  match,
  heroStats,
}: {
  match: Match
  heroStats: HeroStat[]
}) {
  const heroMap = new Map(heroStats.map((h) => [h.id, h]))
  const radiant = match.players.filter((p) => p.player_slot < 128)
  const dire = match.players.filter((p) => p.player_slot >= 128)

  return (
    <div className="space-y-3">
      {/* Team labels */}
      <div className="flex gap-1">
        <div className="flex gap-1">
          {radiant.map((p) => (
            <HeroPortraitCard
              key={p.player_slot}
              player={p}
              hero={heroMap.get(p.hero_id)}
              isRadiant={true}
            />
          ))}
        </div>
        <div className="w-[3px] shrink-0 rounded" style={{ background: '#1a2e45' }} />
        <div className="flex gap-1">
          {dire.map((p) => (
            <HeroPortraitCard
              key={p.player_slot}
              player={p}
              hero={heroMap.get(p.hero_id)}
              isRadiant={false}
            />
          ))}
        </div>
      </div>

      {/* Team labels below */}
      <div className="flex gap-1 text-[10px] uppercase tracking-widest font-semibold" style={{ fontFamily: 'var(--font-dota)' }}>
        <div className="flex gap-1">
          <div style={{ width: `${5 * 128 + 4 * 4}px`, color: '#92c93a' }}>Radiant</div>
        </div>
        <div className="w-[3px] shrink-0" />
        <div style={{ color: '#c23c2a' }}>Dire</div>
      </div>
    </div>
  )
}
