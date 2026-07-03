import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { HeroListItem } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { datafeed } from '@/lib/datafeed'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl } from '@/lib/utils'

export const Route = createFileRoute('/heroes')({
  component: HeroesPage,
})

const ICON_CDN = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/icons'

// Order matches Valve's primary_attr enum: 0 str, 1 agi, 2 int, 3 universal.
const ATTRS = [
  { label: 'Strength', filterIcon: '/filter-str-active.png', symbol: `${ICON_CDN}/hero_strength.png` },
  { label: 'Agility', filterIcon: '/filter-agi-active.png', symbol: `${ICON_CDN}/hero_agility.png` },
  { label: 'Intelligence', filterIcon: '/filter-int-active.png', symbol: `${ICON_CDN}/hero_intelligence.png` },
  { label: 'Universal', filterIcon: '/filter-uni-active.png', symbol: `${ICON_CDN}/hero_universal.png` },
]

/* dota2.com grid metrics at its fixed 1200px column: 225x127 cards, 5 per
   row, 243.75px column pitch, 15px row gap. Kept as fractions so the grid
   scales below 1200px. */
const COLS = 5
const CARD_W = 225 / 1200
const COL_PITCH = 243.75 / 1200
const CARD_RATIO = 127 / 225
const ROW_GAP = 15

function FilterButton({ icon, active, onClick }: { icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-ml-1 h-[34px] w-[44px] cursor-pointer bg-cover bg-no-repeat transition-[filter] duration-100 ease-in-out ${
        active
          ? '[filter:brightness(1)_saturate(1)]'
          : '[filter:brightness(0.5)_saturate(0)] hover:[filter:brightness(0.8)_saturate(0)]'
      }`}
      style={{ backgroundImage: `url(${icon})` }}
    />
  )
}

function HeroCard({
  hero,
  pos,
  size,
}: {
  hero: HeroListItem
  pos: { left: number; top: number } | null
  size: { w: number; h: number }
}) {
  const short = hero.name.replace('npc_dota_hero_', '')
  const attr = ATTRS[hero.primary_attr]
  const hidden = pos === null
  return (
    <a
      href={`/hero/${short}`}
      className="group absolute block overflow-hidden transition-[transform,box-shadow,opacity,top,left] duration-300 ease-out hover:z-[4] hover:scale-[1.4] hover:[box-shadow:3px_3px_8px_#000]"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        width: hidden ? 0 : size.w,
        height: hidden ? 0 : size.h,
        opacity: hidden ? 0 : 1,
        boxShadow: '1px 1px 4px #000',
        background: '#0d0d10',
      }}
    >
      {/* background-size 110% -> 100% on hover, like the real card */}
      <img
        src={heroLandscapeUrl(hero.name)}
        alt={hero.name_loc}
        className="absolute inset-0 h-full w-full scale-110 object-cover transition-transform duration-300 ease-out group-hover:scale-100"
        loading="lazy"
        onError={cdnFallback(heroLandscapeCdn(hero.name))}
      />
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100"
        style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.73) 75%, #000 100%)' }}
      />
      {/* name bar slides up from below the card on hover */}
      <div className="absolute inset-x-0 -bottom-10 flex h-[50px] items-center gap-1.5 pl-1.5 opacity-0 transition-[opacity,bottom] duration-200 ease-out group-hover:bottom-0 group-hover:opacity-100">
        <img
          src={attr.symbol}
          alt={attr.label}
          className="h-[42px] w-[42px]"
          style={{ filter: 'drop-shadow(0 0 4px #000)' }}
        />
        <span
          className="truncate py-2 pr-2 text-[18px] font-semibold tracking-[1px] text-white uppercase"
          style={{ fontFamily: 'var(--font-display)', textShadow: '0 0 4px #000' }}
        >
          {hero.name_loc}
        </span>
      </div>
    </a>
  )
}

function HeroesPage() {
  const heroes = useQuery({ queryKey: ['herolist'], queryFn: () => datafeed.heroList() })
  const [attr, setAttr] = useState<number | null>(null)
  const [complexity, setComplexity] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const gridRef = useRef<HTMLDivElement>(null)
  const [gridW, setGridW] = useState(1200)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setGridW(el.clientWidth))
    ro.observe(el)
    setGridW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const sorted = [...(heroes.data ?? [])].sort((a, b) => a.name_loc.localeCompare(b.name_loc))
  const q = query.trim().toLowerCase()
  const matches = (h: HeroListItem) =>
    (attr === null || h.primary_attr === attr) &&
    (complexity === null || h.complexity === complexity) &&
    (!q || h.name_loc.toLowerCase().includes(q))

  const size = { w: gridW * CARD_W, h: gridW * CARD_W * CARD_RATIO }
  const colPitch = gridW * COL_PITCH
  const rowPitch = size.h + ROW_GAP
  let visIndex = 0
  const cards = sorted.map((h) => {
    if (!matches(h)) return { hero: h, pos: null }
    const i = visIndex++
    return { hero: h, pos: { left: (i % COLS) * colPitch, top: Math.floor(i / COLS) * rowPitch } }
  })
  const rows = Math.ceil(visIndex / COLS)
  const gridH = rows > 0 ? rows * rowPitch - ROW_GAP : 0

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Title */}
      <div className="pt-16 text-center">
        <h1
          className="text-[54px] leading-[1.12] font-bold tracking-[3px] text-white uppercase"
          style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}
        >
          Choose Your Hero
        </h1>
        <p className="mx-auto max-w-[1000px] text-[26px] leading-[1.4] text-[#ddd]" style={{ marginBottom: 30 }}>
          From magical tacticians to fierce brutes and cunning rogues, Dota 2's hero pool is massive and
          limitlessly diverse. Unleash incredible abilities and devastating ultimates on your way to victory.
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="mt-5 flex items-center justify-between p-[10px]"
        style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.3))' }}
      >
        <div className="mx-[10px] text-[18px] tracking-[2px] text-white uppercase">Filter Heroes</div>

        <div className="ml-5 flex items-center">
          <div className="mr-5 text-[17px] tracking-[2px] text-[#808fa6] uppercase">Attribute</div>
          {ATTRS.map((a, i) => (
            <FilterButton
              key={a.label}
              icon={a.filterIcon}
              active={attr === i}
              onClick={() => setAttr(attr === i ? null : i)}
            />
          ))}
        </div>

        <div className="ml-5 flex items-center">
          <div className="mr-5 text-[17px] tracking-[2px] text-[#808fa6] uppercase">Complexity</div>
          {[1, 2, 3].map((lvl) => (
            <FilterButton
              key={lvl}
              icon="/filter-diamond.png"
              active={complexity !== null && lvl <= complexity}
              onClick={() => setComplexity(complexity === lvl ? null : lvl)}
            />
          ))}
        </div>

        <div className="flex h-[50px] w-[250px] items-center" style={{ background: '#25282a' }}>
          <img src="/search_icon.svg" alt="" className="mx-[10px] h-[26px] w-[26px]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mr-[10px] h-[30px] w-full border-0 bg-transparent p-1 text-[18px] text-white outline-none"
          />
        </div>
      </div>

      {heroes.isPending && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Hero grid: absolutely positioned cards so filtering animates them
          to their new slots, exactly like dota2.com */}
      <div ref={gridRef} className="relative mt-[15px] transition-[height] duration-300 ease-out" style={{ height: gridH }}>
        {cards.map(({ hero, pos }) => (
          <HeroCard key={hero.id} hero={hero} pos={pos} size={size} />
        ))}
      </div>
    </div>
  )
}
