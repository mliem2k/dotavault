import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { AbilityDetails } from '@/components/heroes/ability_details'
import { Spinner } from '@/components/ui/spinner'
import { datafeed } from '@/lib/datafeed'
import { opendota } from '@/lib/opendota'
import { INNATE_ICON_CDN, TALENTS_ICON_CDN, abilityIconCdn, abilityIconUrl, heroLandscapeCdn } from '@/lib/utils'

export const Route = createFileRoute('/hero/$heroName')({
  component: HeroDetailPage,
})

const ATTR: Record<string, { label: string; color: string }> = {
  str: { label: 'Strength', color: '#e24b3a' },
  agi: { label: 'Agility', color: '#a2d240' },
  int: { label: 'Intelligence', color: '#4fb0e0' },
  all: { label: 'Universal', color: '#c47adf' },
}

// The same animated, transparent hero render dota2.com uses on its hero pages.
const RENDER = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders'
function heroRenderPoster(short: string): string {
  return `${RENDER}/${short}.png`
}

// Per-hero render placement overrides, ported verbatim from dota2.com's CSS.
// The base wrapper centers the square render in a 75%-wide, banner-height box;
// these nudge heroes whose model would otherwise sit off-center.
const RENDER_TWEAKS: Record<string, React.CSSProperties> = {
  abaddon: { alignItems: 'flex-start', top: '-3%' },
  bloodseeker: { maxWidth: 1400, right: 0 },
  primal_beast: { width: '100%', right: '-22%' },
  broodmother: { width: '100%', right: '-20%' },
  largo: { top: '6%' },
  bristleback: { right: '5%' },
  dawnbreaker: { right: '-10%' },
  puck: { minHeight: 0, width: '50%', right: '5%', top: '-5%' },
  sniper: { minHeight: 0, width: '40%', right: '10%', top: '-5%' },
  kez: { top: '-10%', right: '-20%', width: '100%' },
  hoodwink: { width: '40%' },
  meepo: { top: '-10%' },
}

// dota2.com's own attribute and per-stat icons (used in the header and stat bar).
const REACT_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react'
const ATTR_ICON_NAME: Record<string, string> = {
  str: 'strength',
  agi: 'agility',
  int: 'intelligence',
  all: 'universal',
}
const attrIconUrl = (a: string) => `${REACT_CDN}/icons/hero_${ATTR_ICON_NAME[a] ?? 'strength'}.png`
const statIconUrl = (name: string) => `${REACT_CDN}/heroes/stats/icon_${name}.png`

// Valve's hype/bio text uses <b> for emphasis; render that as bold and drop any other tags.
function HistoryText({ text }: { text: string }) {
  const cleaned = text.replace(/<(?!\/?b>)[^>]*>/gi, '')
  const parts = cleaned.split(/(<\/?b>)/i)
  let bold = false
  return (
    <>
      {parts.map((p, i) => {
        if (/^<b>$/i.test(p)) {
          bold = true
          return null
        }
        if (/^<\/b>$/i.test(p)) {
          bold = false
          return null
        }
        if (!p) return null
        return bold ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a fixed string
          <strong key={i} style={{ fontWeight: 700, color: '#e8e2d4' }}>
            {p}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a fixed string
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}

function parseTalent(dname: string): { sign: string | null; value: string | null; unit: string; text: string } {
  // Explicit numeric: "+10 All Attributes", "+5s Reflection Duration"
  const explicit = dname.match(/^([+\-])(\d+)([a-z%]*)\s+(.+)$/i)
  if (explicit) return { sign: explicit[1], value: explicit[2], unit: explicit[3], text: explicit[4] }
  // Template value: "+{s:bonus_x}s Description", "-{s:...}% Description"
  const template = dname.match(/^([+\-])\{[^}]*\}([a-z%]*)\s+(.+)$/i)
  if (template) return { sign: template[1], value: null, unit: template[2], text: template[3] }
  return { sign: null, value: null, unit: '', text: dname.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim() }
}

// The nine canonical Dota role categories, shown in the header stat bar (dota2.com order).
const ALL_ROLES = [
  'Carry',
  'Support',
  'Nuker',
  'Disabler',
  'Jungler',
  'Durable',
  'Escape',
  'Pusher',
  'Initiator',
]

// One icon + value row inside an Attack / Defense / Mobility group (dota2.com sizing: 14px/600).
function IconStat({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-[3px]">
      <img src={statIconUrl(icon)} alt="" className="h-[22px] w-[22px] shrink-0 opacity-90" />
      <span
        className="text-[14px] tabular-nums"
        style={{ color: '#fff', fontWeight: 600, fontFamily: 'var(--font-dota)' }}
      >
        {value}
      </span>
    </div>
  )
}

// A titled column (Attack / Defense / Mobility) in the stat bar. Matches dota2.com: 16px/700 grey.
function StatGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div
        className="text-[16px] font-bold uppercase mb-2"
        style={{ color: '#969696', letterSpacing: '1px', fontFamily: 'var(--font-dota)' }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// One attribute row: attribute icon + base value (Reaver 20px/600) + growth. Matches dota2.com.
function AttrRow({ attrKey, base, gain }: { attrKey: string; base: number; gain: number }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <img src={attrIconUrl(attrKey)} alt="" className="h-7 w-7 shrink-0" />
      <span
        className="text-[20px] tabular-nums leading-none"
        style={{ color: '#fff', fontWeight: 600, fontFamily: 'var(--font-display)' }}
      >
        {base}
      </span>
      <span className="text-[15px] tabular-nums" style={{ color: '#999999' }}>
        +{gain.toFixed(1)}
      </span>
    </div>
  )
}

// A hero-total bar (health green / mana blue) with the value and growth, as under dota2.com's portrait.
function TotalBar({ fill, value, gain }: { fill: string; value: number; gain: number }) {
  return (
    <div
      className="relative flex items-center justify-between px-2 rounded-[2px] overflow-hidden"
      style={{ height: 20, background: fill }}
    >
      <span
        className="text-[13px] tabular-nums"
        style={{ color: '#fff', fontWeight: 800, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        {value}
      </span>
      <span
        className="text-[12px] tabular-nums"
        style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
      >
        +{gain.toFixed(1)}
      </span>
    </div>
  )
}

function HeroDetailPage() {
  const { heroName } = Route.useParams()
  const heroStats = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const heroAbilities = useQuery({
    queryKey: ['hero_abilities'],
    queryFn: () => opendota.heroAbilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const abilities = useQuery({
    queryKey: ['abilities_constants'],
    queryFn: () => opendota.abilities(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const heroLore = useQuery({
    queryKey: ['hero_lore'],
    queryFn: () => opendota.heroLore(),
    staleTime: Number.POSITIVE_INFINITY,
  })
  const aghsDesc = useQuery({
    queryKey: ['aghs_desc'],
    queryFn: () => opendota.aghsDesc(),
    staleTime: Number.POSITIVE_INFINITY,
  })

  const hero = heroStats.data?.find((h) => h.name === `npc_dota_hero_${heroName}`)

  // Live tagline / complexity / exact stats from Valve's datafeed (via /df proxy).
  const heroData = useQuery({
    queryKey: ['hero_datafeed', hero?.id],
    queryFn: () => datafeed.heroData(hero!.id),
    enabled: !!hero?.id,
    staleTime: Number.POSITIVE_INFINITY,
  })
  // Whether the header's lore is expanded to its full history inline.
  const [loreOpen, setLoreOpen] = useState(false)
  const [selectedAbilityIdx, setSelectedAbilityIdx] = useState(0)
  const [talentOpen, setTalentOpen] = useState(false)
  const abilityDetailRef = useRef<HTMLDivElement>(null)

  function selectAbilityOnBanner(name: string) {
    const idx = abilityList.indexOf(name)
    if (idx >= 0) {
      setSelectedAbilityIdx(idx)
      abilityDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (heroStats.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }
  if (!hero) return <div className="text-sm text-muted">Hero not found.</div>

  const short = hero.name.replace('npc_dota_hero_', '')
  const attr = ATTR[hero.primary_attr] ?? { label: hero.primary_attr, color: '#888' }
  // Abilities & talents
  const ha = heroAbilities.data?.[hero.name]
  const lore = heroLore.data?.[short]
  const aghs = aghsDesc.data?.find((x) => x.hero_name === hero.name)
  // Ability names that are NEW skills granted by scepter or shard (not modifications of existing abilities).
  // Identified by matching the aghs skill display name against ability dnames.
  const aghsNewSkills = (() => {
    const s = new Set<string>()
    if (!aghs || !abilities.data) return s
    for (const a of ha?.abilities ?? []) {
      if (!a) continue
      const dname = abilities.data[a]?.dname
      if (aghs.has_scepter && aghs.scepter_new_skill && dname === aghs.scepter_skill_name) s.add(a)
      if (aghs.has_shard && aghs.shard_new_skill && dname === aghs.shard_skill_name) s.add(a)
    }
    return s
  })()
  const abilityList = (ha?.abilities ?? []).filter((a) => {
    if (!a || a === 'generic_hidden' || a.startsWith('special_') || aghsNewSkills.has(a)) return false
    const ab = abilities.data?.[a]
    if (ab?.is_innate) return false
    const beh = ab?.behavior
    const isHidden = Array.isArray(beh)
      ? beh.some((s) => String(s).includes('Hidden'))
      : String(beh ?? '').includes('Hidden')
    return !isHidden
  })
  const innateList = (ha?.abilities ?? []).filter((a) => {
    if (!a || a === 'generic_hidden' || a.startsWith('special_') || aghsNewSkills.has(a)) return false
    const ab = abilities.data?.[a]
    if (ab?.is_innate) return true
    const beh = ab?.behavior
    return Array.isArray(beh)
      ? beh.some((s) => String(s).includes('Hidden'))
      : String(beh ?? '').includes('Hidden')
  })
  const meta = heroData.data
  // dota2.com shows the short hype blurb by default and the full bio behind "Read Full History".
  const shortHistory = meta?.hype || meta?.bio || lore || ''
  const fullHistory = meta?.bio || lore || ''
  const history = loreOpen ? fullHistory : shortHistory
  const talents = ha?.talents ?? []
  const talentTiers = [4, 3, 2, 1].map((lvl) => ({
    lvl: [0, 10, 15, 20, 25][lvl],
    pair: talents.filter((t) => t.level === lvl),
  }))
  // Prev / next hero (alphabetical), used by the top-right nav and the footer.
  const sortedHeroes = [...(heroStats.data ?? [])].sort((a, b) =>
    a.localized_name.localeCompare(b.localized_name),
  )
  const heroIdx = sortedHeroes.findIndex((h) => h.name === hero.name)
  // Wraps around like dota2.com (Abaddon's previous hero is Zeus).
  const prevHero = sortedHeroes[(heroIdx - 1 + sortedHeroes.length) % sortedHeroes.length]
  const nextHero = sortedHeroes[(heroIdx + 1) % sortedHeroes.length]
  // dota2.com shows attack damage including the primary-attribute bonus (universal: 45% of all).
  const attrBonus = meta
    ? hero.primary_attr === 'str'
      ? meta.str_base
      : hero.primary_attr === 'agi'
        ? meta.agi_base
        : hero.primary_attr === 'int'
          ? meta.int_base
          : Math.floor(0.45 * (meta.str_base + meta.agi_base + meta.int_base))
    : 0

  return (
    <div className="space-y-4">
      {/* Hero header — dota2.com layout: text column top-left, animated render bleeding right */}
      <div
        className="relative overflow-hidden -mx-6 -mt-[calc(2rem+5rem)]"
        style={{
          minHeight: 780,
          background: '#000 url(/backgrounds/greyfade.jpg) no-repeat top center / 100%',
        }}
      >
        {/* diagonal darker band across the backdrop, same skew matrix as dota2.com */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: 40,
            left: 140,
            width: 2700,
            height: 650,
            background: 'rgba(0,0,0,0.376)',
            transform: 'matrix(1, -1, 0, 1, -900, 900)',
          }}
        />
        {/* the animated, transparent hero render — dota2.com layout: a 75%-wide,
            banner-height flex box that centers the square clip, with per-hero
            placement tweaks ported from their CSS */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{ width: '75%', height: '100%', top: 0, right: '5%', ...RENDER_TWEAKS[short] }}
        >
          <video
            key={short}
            autoPlay
            loop
            muted
            playsInline
            poster={heroRenderPoster(short)}
            style={{ width: '100%', maxWidth: 1350, aspectRatio: '1 / 1', objectFit: 'contain' }}
          >
            <source type="video/webm" src={`${RENDER}/${short}.webm`} />
            <source type='video/mp4; codecs="hvc1"' src={`${RENDER}/${short}.mov`} />
          </video>
        </div>
        {/* bottom fade into the stat bar, same gradient dota2.com uses */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.733) 75%, rgb(0,0,0) 100%)',
          }}
        />
        {/* left rail: vertical hero name + id + attribute icon */}
        <div
          className="absolute z-[3] hidden lg:flex flex-col items-center"
          style={{ left: 50, top: 0, bottom: 70, width: 50 }}
        >
          <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.25)' }} />
          <div
            className="uppercase"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              color: '#fff',
              fontSize: 16,
              letterSpacing: '4px',
              margin: '18px 0 4px',
              fontFamily: 'var(--font-dota)',
            }}
          >
            {hero.localized_name}
          </div>
          <div
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 14,
              letterSpacing: '2px',
              marginBottom: 16,
            }}
          >
            {hero.id}
          </div>
          <img src={attrIconUrl(hero.primary_attr)} alt="" style={{ width: 28, height: 28 }} />
        </div>
        {/* top-right prev / all / next navigation */}
        <div className="absolute z-[4] flex items-center gap-2" style={{ top: 160, right: 30 }}>
          {prevHero && (
            <a
              href={`/hero/${prevHero.name.replace('npc_dota_hero_', '')}`}
              title={prevHero.localized_name}
              className="flex items-center justify-center hover:bg-white/10"
              style={{
                width: 40,
                height: 40,
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ‹
            </a>
          )}
          <a
            href="/heroes"
            title="All Heroes"
            className="grid grid-cols-3 place-items-center hover:bg-white/10"
            style={{
              width: 56,
              height: 56,
              border: '1px solid rgba(255,255,255,0.5)',
              padding: 10,
              gap: 3,
            }}
          >
            {[...Array(6)].map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
              <span key={i} style={{ width: 9, height: 9, background: '#fff', display: 'block' }} />
            ))}
          </a>
          {nextHero && (
            <a
              href={`/hero/${nextHero.name.replace('npc_dota_hero_', '')}`}
              title={nextHero.localized_name}
              className="flex items-center justify-center hover:bg-white/10"
              style={{
                width: 40,
                height: 40,
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ›
            </a>
          )}
        </div>
        {/* text column, in normal flow so the banner grows when the lore expands.
            Left inset (~9% of the banner) matches dota2.com's content gutter. */}
        <div className="relative z-10 pl-[9.4%] pr-6 pt-[calc(5rem+3.75rem)] pb-24 max-w-[740px]">
          <div className="flex items-center mb-0.5">
            <img
              src={attrIconUrl(hero.primary_attr)}
              alt=""
              className="h-[32px] w-[32px] shrink-0"
            />
            <span
              className="ml-1.5 text-[24px] uppercase"
              style={{
                color: '#fff',
                fontWeight: 100,
                letterSpacing: '2px',
                fontFamily: 'var(--font-dota)',
              }}
            >
              {attr.label}
            </span>
          </div>
          <h1
            className="text-[80px] font-bold uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#fff',
              lineHeight: '88px',
              letterSpacing: '2px',
              marginTop: 12,
            }}
          >
            {hero.localized_name}
          </h1>
          {meta?.tagline && (
            <div
              className="mt-2 text-[18px] font-bold uppercase"
              style={{
                color: '#a5e0f3',
                fontFamily: 'var(--font-dota)',
                letterSpacing: '2px',
                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              }}
            >
              {meta.tagline}
            </div>
          )}
          {history && (
            <>
              <p
                className="text-[24px]"
                style={{
                  color: '#eeeeee',
                  fontFamily: 'var(--font-dota)',
                  fontWeight: 200,
                  lineHeight: 1.5,
                  marginTop: 14,
                }}
              >
                <HistoryText text={history} />
              </p>
              {fullHistory && fullHistory !== shortHistory && (
                <button
                  type="button"
                  onClick={() => setLoreOpen((v) => !v)}
                  className="inline-block mt-2 text-[18px] underline cursor-pointer hover:text-white"
                  style={{ color: '#8a8a8a', fontWeight: 200, fontFamily: 'var(--font-dota)' }}
                >
                  {loreOpen ? 'Close History' : 'Read Full History'}
                </button>
              )}
            </>
          )}
          <div
            className="text-[17px] font-bold uppercase"
            style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px', marginTop: 30 }}
          >
            Attack Type
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <img
              src={`https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/${hero.attack_type.toLowerCase()}.svg`}
              alt=""
              style={{ width: 24, height: 24, filter: 'brightness(0) invert(1)' }}
            />
            <span
              className="text-[15px] font-bold uppercase"
              style={{ color: '#fff', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
            >
              {hero.attack_type}
            </span>
          </div>
          {meta && (
            <>
              <div
                className="text-[17px] font-bold uppercase"
                style={{ color: '#959595', fontFamily: 'var(--font-dota)', letterSpacing: '2px', marginTop: 30 }}
              >
                Complexity
              </div>
              <div className="flex" style={{ gap: 12, marginTop: 8, marginLeft: 4 }}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    style={{
                      width: 15,
                      height: 15,
                      display: 'block',
                      transform: 'rotate(45deg)',
                      border: '1px solid #fff',
                      background: n <= meta.complexity ? '#fff' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {/* ABILITIES — anchored bottom-center-right of the banner, matching dota2.com layout.
            Innate (hidden-behavior) abilities shown as circular icons first, regular as square. */}
        {(abilityList.length > 0 || innateList.length > 0) && abilities.data && (
          <div
            className="absolute z-[2] flex flex-col items-start"
            style={{ bottom: 40, right: 'min(140px, 7.8vw)' }}
          >
            <div
              className="text-[18px] font-bold uppercase mb-1.5"
              style={{ color: '#ffffff', fontFamily: 'var(--font-dota)', letterSpacing: '2px' }}
            >
              Abilities
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {talents.length > 0 && abilities.data && (
                <button
                  type="button"
                  onClick={() => setTalentOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    width: 72,
                    height: 72,
                    overflow: 'visible',
                    position: 'relative',
                    display: 'flex',
                    transitionProperty: 'transform',
                    transitionTimingFunction: 'ease',
                    transitionDuration: '0.15s',
                    fontFamily: 'Radiance, "Noto Sans", sans-serif',
                    color: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <img
                    src={TALENTS_ICON_CDN}
                    alt="Talents"
                    style={{ width: 72, height: 72 }}
                  />
                </button>
              )}
              {innateList.map((name) => {
                const ab = abilities.data?.[name]
                const beh = Array.isArray(ab?.behavior)
                  ? (ab.behavior as string[]).filter((b) => b !== 'Hidden').join(' / ')
                  : ab?.behavior ? String(ab.behavior) : null
                const attribs = (ab?.attrib ?? []).filter(
                  (x) => x.header && x.value != null && x.value !== '' && !x.generated,
                )
                return (
                  <div key={name} className="relative group shrink-0">
                    <img
                      src={abilityIconUrl(name)}
                      alt={ab?.dname ?? name}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: 'cover',
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.25)',
                        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
                        cursor: 'default',
                      }}
                      onError={(ev) => {
                        const el = ev.currentTarget
                        const step = el.dataset.step ?? '0'
                        if (step === '0') {
                          el.dataset.step = '1'
                          el.src = abilityIconCdn(name, abilities.data?.[name]?.img)
                        } else {
                          el.dataset.step = '2'
                          el.src = INNATE_ICON_CDN
                        }
                      }}
                    />
                    <div
                      className="absolute bottom-full mb-2 hidden group-hover:block z-50 pointer-events-none"
                      style={{
                        left: '50%',
                        transform: 'translateX(-20%)',
                        width: 280,
                        background: 'rgba(10,9,12,0.97)',
                        border: '1px solid #24222a',
                        padding: '10px 14px',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <img
                          src={abilityIconUrl(name)}
                          alt=""
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            border: '2px solid rgba(255,255,255,0.2)',
                            flexShrink: 0,
                            objectFit: 'cover',
                          }}
                          onError={(ev) => { ev.currentTarget.src = INNATE_ICON_CDN }}
                        />
                        <div>
                          <div
                            style={{
                              color: '#fff',
                              fontFamily: 'var(--font-display)',
                              fontSize: 14,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                            }}
                          >
                            {ab?.dname ?? name}
                          </div>
                          {ab?.desc && (
                            <div
                              style={{
                                color: '#c8c2b4',
                                fontFamily: 'var(--font-dota)',
                                fontSize: 11,
                                lineHeight: 1.4,
                                marginTop: 3,
                              }}
                            >
                              {ab.desc}
                            </div>
                          )}
                        </div>
                      </div>
                      {beh && (
                        <div
                          style={{
                            color: '#6a675e',
                            fontFamily: 'var(--font-dota)',
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            marginBottom: attribs.length > 0 ? 6 : 0,
                          }}
                        >
                          {beh}
                        </div>
                      )}
                      {attribs.map((x, i) => (
                        <div
                          key={i}
                          className="flex justify-between"
                          style={{ borderTop: '1px solid #1e1a12', paddingTop: 4, paddingBottom: 4 }}
                        >
                          <span
                            style={{
                              color: '#6a675e',
                              fontFamily: 'var(--font-dota)',
                              fontSize: 10,
                              textTransform: 'uppercase',
                            }}
                          >
                            {x.header}
                          </span>
                          <span
                            style={{
                              color: '#c8c2b4',
                              fontFamily: 'var(--font-dota)',
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {Array.isArray(x.value) ? (x.value as (string | number)[]).join(' / ') : String(x.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {abilityList.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={abilities.data?.[name]?.dname ?? name}
                  onClick={() => selectAbilityOnBanner(name)}
                  className="rounded-sm p-0 shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <img
                    src={abilityIconUrl(name)}
                    alt={abilities.data?.[name]?.dname ?? name}
                    className="rounded-sm block"
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.15)',
                      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
                    }}
                    onError={(ev) => {
                      const el = ev.currentTarget
                      const step = el.dataset.step ?? '0'
                      if (step === '0') {
                        el.dataset.step = '1'
                        el.src = abilityIconCdn(name, abilities.data?.[name]?.img)
                      } else {
                        el.style.display = 'none'
                      }
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header stat bar — portrait, attributes, roles and Attack/Defense/Mobility (dota2.com layout).
          Sections are flex-col with justify-between so their labels share the same baseline. */}
      <div
        className="-mx-6 -mt-4 pl-[4.3%] pr-[4.3%] pt-5 pb-4 flex gap-x-9 gap-y-4"
        style={{
          background: 'linear-gradient(80deg, rgb(37,39,40) 0%, rgb(16,20,21) 100%)',
          borderTop: '2px solid rgb(40,40,40)',
          borderBottom: '2px solid rgb(44,46,46)',
          boxShadow: 'rgb(0,0,0) 0px 0px 8px',
          minHeight: 221,
        }}
      >
        {/* ATTRIBUTES: portrait + attr rows + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-center gap-4">
            <div className="flex flex-col gap-1.5" style={{ width: 150 }}>
              <img
                src={heroLandscapeCdn(hero.name)}
                alt={hero.localized_name}
                className="w-full rounded-sm"
                style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
              />
              {meta && (
                <>
                  <TotalBar fill="#5c8a2c" value={meta.max_health} gain={meta.health_regen} />
                  <TotalBar fill="#2f74c0" value={meta.max_mana} gain={meta.mana_regen} />
                </>
              )}
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
              <AttrRow
                attrKey="str"
                base={meta?.str_base ?? hero.base_str}
                gain={meta?.str_gain ?? hero.str_gain}
              />
              <AttrRow
                attrKey="agi"
                base={meta?.agi_base ?? hero.base_agi}
                gain={meta?.agi_gain ?? hero.agi_gain}
              />
              <AttrRow
                attrKey="int"
                base={meta?.int_base ?? hero.base_int}
                gain={meta?.int_gain ?? hero.int_gain}
              />
            </div>
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Attributes
          </span>
        </div>

        {/* ROLES: level-scaled bars + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
            {ALL_ROLES.map((r, i) => {
              const level = meta?.role_levels?.[i] ?? (hero.roles.includes(r) ? 3 : 0)
              const active = level > 0
              return (
                <div key={r} className="flex flex-col gap-1.5">
                  <span
                    className="text-[15px] font-bold"
                    style={{
                      color: active ? '#ffffff' : '#5c584e',
                      letterSpacing: '1px',
                      fontFamily: 'var(--font-dota)',
                    }}
                  >
                    {r}
                  </span>
                  <span className="relative h-[3px] rounded-full" style={{ background: '#3a3a3e' }}>
                    {active && (
                      <span
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${(level / 3) * 100}%`,
                          background: '#f2f4f8',
                          boxShadow: '0 0 5px 1px rgba(120,170,235,0.7)',
                        }}
                      />
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Roles
          </span>
        </div>

        {/* STATS: Attack / Defense / Mobility + label */}
        <div className="flex-1 flex flex-col justify-between gap-3">
          <div className="flex items-start justify-center gap-x-10">
            <StatGroup title="Attack">
              <IconStat
                icon="damage"
                value={
                  meta
                    ? `${meta.damage_min + attrBonus}-${meta.damage_max + attrBonus}`
                    : `${hero.base_attack_min}-${hero.base_attack_max}`
                }
              />
              <IconStat icon="attack_time" value={meta ? String(+meta.attack_rate.toFixed(2)) : '1.7'} />
              <IconStat icon="attack_range" value={String(meta?.attack_range ?? hero.attack_range)} />
              {meta && <IconStat icon="projectile_speed" value={meta.projectile_speed} />}
            </StatGroup>

            <StatGroup title="Defense">
              <IconStat icon="armor" value={(meta?.armor ?? hero.base_armor).toFixed(1)} />
              {meta && <IconStat icon="magic_resist" value={`${meta.magic_resistance}%`} />}
            </StatGroup>

            <StatGroup title="Mobility">
              <IconStat
                icon="movement_speed"
                value={String(meta?.movement_speed ?? hero.move_speed)}
              />
              {meta && <IconStat icon="turn_rate" value={meta.turn_rate.toFixed(1)} />}
              {meta && (
                <IconStat
                  icon="vision"
                  value={`${meta.sight_range_day} / ${meta.sight_range_night}`}
                />
              )}
            </StatGroup>
          </div>
          <span
            className="text-[18px] uppercase text-center"
            style={{ color: '#969696', fontFamily: 'var(--font-dota)', letterSpacing: '2px', fontWeight: 400 }}
          >
            Stats
          </span>
        </div>
      </div>

      {/* Ability Details */}
      {abilityList.length > 0 && abilities.data && (
        <div
          ref={abilityDetailRef}
          style={{
            color: '#fff',
            boxSizing: 'border-box',
            fontFamily: 'Radiance, "Noto Sans", sans-serif',
            width: '100%',
            minHeight: 400,
            padding: '80px 0',
            marginTop: -10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div
            className="text-center pb-6 uppercase"
            style={{
              color: '#ffffff',
              fontFamily: 'var(--font-dota)',
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: '3px',
            }}
          >
            Ability Details:
          </div>
          <div style={{ width: '100%' }}>
            <AbilityDetails
              heroShort={short}
              abilityList={abilityList}
              abilities={abilities.data}
              aghs={aghs}
              innateNames={innateList}
              hasTalents={talents.length > 0}
              aghsNewSkillNames={[...aghsNewSkills]}
              selectedIdx={selectedAbilityIdx}
              onSelectIdx={setSelectedAbilityIdx}
            />
          </div>
        </div>
      )}

      {/* Hero navigation footer — 150px bar, hero busts rise above it like dota2.com */}
      {(() => {
        const IMG = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react'
        const cropUrl = (n: string) => `${IMG}/heroes/crops/${n.replace('npc_dota_hero_', '')}.png`
        const ATTR_ICON: Record<string, string> = { str: 'hero_strength', agi: 'hero_agility', int: 'hero_intelligence', all: 'hero_universal' }
        const attrIcon = (attr: string) => `${IMG}/icons/${ATTR_ICON[attr] ?? 'hero_universal'}.png`
        const BG = `url("${IMG}/backgrounds/grey_painterly_wide.png")`
        const linkBase: React.CSSProperties = {
          position: 'relative', display: 'flex', alignItems: 'center', height: '100%',
          width: '45%', backgroundImage: BG, backgroundSize: 'cover', backgroundPosition: 'center',
          textDecoration: 'none', color: '#fff', padding: '0 30px',
          transition: 'filter 0.15s',
        }
        const nameStyle: React.CSSProperties = {
          fontSize: 28, fontWeight: 700, color: '#fff', textTransform: 'uppercase',
          letterSpacing: '1px', fontFamily: 'var(--font-display)',
        }
        const labelStyle: React.CSSProperties = {
          fontSize: 15, color: '#9f9f9f', textTransform: 'uppercase',
          letterSpacing: '2px', marginBottom: 5,
        }
        const cropStyle: React.CSSProperties = {
          position: 'absolute', bottom: -20, width: 400, height: 250, maxWidth: '90%',
          objectFit: 'contain', pointerEvents: 'none',
        }
        return (
          <div
            className="-mx-6"
            style={{
              fontFamily: 'Radiance, "Noto Sans", sans-serif',
              color: '#fff', boxSizing: 'border-box',
              width: 'calc(100% + 3rem)', height: 150,
              backgroundColor: '#111',
              marginTop: 40,
              display: 'flex', flexDirection: 'row', alignItems: 'center',
            }}
          >
            {prevHero ? (
              <a
                href={`/hero/${prevHero.name.replace('npc_dota_hero_', '')}`}
                className="hover:brightness-125"
                style={{ ...linkBase, justifyContent: 'flex-end' }}
              >
                <img src={cropUrl(prevHero.name)} alt={prevHero.localized_name} style={{ ...cropStyle, left: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={labelStyle}>Previous Hero</div>
                  <div style={nameStyle}>{prevHero.localized_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <img src={attrIcon(prevHero.primary_attr)} alt="" style={{ width: 24, height: 24 }} />
                    <div style={{ fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {prevHero.attack_type}
                    </div>
                  </div>
                </div>
              </a>
            ) : <div style={{ width: '45%' }} />}

            <a
              href="/heroes"
              className="hover:bg-white/10"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flex: 1, height: '100%', textDecoration: 'none', color: '#fff', gap: 10 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 14px)', gap: 5 }}>
                {[...Array(6)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
                  <div key={i} style={{ width: 14, height: 14, background: 'rgba(255,255,255,0.85)' }} />
                ))}
              </div>
              <div style={{ fontSize: 15, letterSpacing: '2px', textTransform: 'uppercase' }}>
                All Heroes
              </div>
            </a>

            {nextHero ? (
              <a
                href={`/hero/${nextHero.name.replace('npc_dota_hero_', '')}`}
                className="hover:brightness-125"
                style={{ ...linkBase, justifyContent: 'flex-start' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={labelStyle}>Next Hero</div>
                  <div style={nameStyle}>{nextHero.localized_name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <img src={attrIcon(nextHero.primary_attr)} alt="" style={{ width: 24, height: 24 }} />
                    <div style={{ fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {nextHero.attack_type}
                    </div>
                  </div>
                </div>
                <img src={cropUrl(nextHero.name)} alt={nextHero.localized_name} style={{ ...cropStyle, right: 0 }} />
              </a>
            ) : <div style={{ width: '45%' }} />}
          </div>
        )
      })()}

      {/* Talent tree overlay */}
      {talentOpen && abilities.data && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={() => setTalentOpen(false)}
        >
          <div
            style={{
              fontFamily: 'Radiance, "Noto Sans", sans-serif',
              color: '#fff',
              boxSizing: 'border-box',
              background: '#0d0c0a',
              border: '1px solid #24222a',
              minWidth: 560,
              maxWidth: '92vw',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setTalentOpen(false)}
              style={{
                position: 'absolute',
                top: 10,
                right: 14,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6a675e',
                fontSize: 18,
                lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
            <div style={{ padding: '16px 20px 20px' }}>
              {/* Title */}
              <div
                style={{
                  textAlign: 'center',
                  color: '#c8c2b4',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '4px',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #24222a',
                  paddingBottom: 10,
                  marginBottom: 8,
                  fontFamily: 'Radiance, "Noto Sans", sans-serif',
                }}
              >
                Talent Tree
              </div>
              {/* Talent rows */}
              {talentTiers.map(({ lvl, pair }) => {
                if (pair.length === 0) return null
                const lDname = abilities.data?.[pair[0]?.name ?? '']?.dname ?? ''
                const rDname = abilities.data?.[pair[1]?.name ?? '']?.dname ?? ''
                return (
                  <div
                    key={lvl}
                    style={{ display: 'flex', alignItems: 'stretch', marginBottom: 4 }}
                  >
                    {/* Left talent */}
                    <div
                      style={{
                        flex: 1,
                        background: '#14130f',
                        border: '1px solid #1e1a12',
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontSize: 13,
                        color: '#e8e0d0',
                        fontFamily: 'Radiance, "Noto Sans", sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {lDname}
                    </div>
                    {/* Level diamond node */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#0d0c0a',
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          transform: 'rotate(45deg)',
                          background: '#1a1710',
                          border: '2px solid #c9a94a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            transform: 'rotate(-45deg)',
                            display: 'block',
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#c9a94a',
                            fontFamily: 'Radiance, "Noto Sans", sans-serif',
                            lineHeight: 1,
                          }}
                        >
                          {lvl}
                        </span>
                      </div>
                    </div>
                    {/* Right talent */}
                    <div
                      style={{
                        flex: 1,
                        background: '#14130f',
                        border: '1px solid #1e1a12',
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: 13,
                        color: '#e8e0d0',
                        fontFamily: 'Radiance, "Noto Sans", sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {rDname}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
