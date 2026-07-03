import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { HeroStat } from 'types'
import { Spinner } from '@/components/ui/spinner'
import { opendota } from '@/lib/opendota'
import { cdnFallback, heroLandscapeCdn, heroLandscapeUrl } from '@/lib/utils'

export const Route = createFileRoute('/heroes')({
  component: HeroesPage,
})

const ATTRS = [
  { key: 'str', label: 'Strength', color: 'var(--color-str)' },
  { key: 'agi', label: 'Agility', color: 'var(--color-agi)' },
  { key: 'int', label: 'Intelligence', color: 'var(--color-int)' },
  { key: 'all', label: 'Universal', color: 'var(--color-uni)' },
] as const

function HeroCard({ hero }: { hero: HeroStat }) {
  const short = hero.name.replace('npc_dota_hero_', '')
  const attr = ATTRS.find((a) => a.key === hero.primary_attr)
  return (
    <a
      href={`/hero/${short}`}
      className="group relative block overflow-hidden"
      style={{ aspectRatio: '16 / 9', background: '#0d0d10' }}
    >
      <img
        src={heroLandscapeUrl(hero.name)}
        alt={hero.localized_name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
        loading="lazy"
        onError={cdnFallback(heroLandscapeCdn(hero.name))}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85) 100%)' }}
      />
      {/* attribute stripe */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: attr?.color ?? '#888' }} />
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5">
        <span
          className="block truncate text-[13px] font-semibold uppercase tracking-wide"
          style={{ color: '#fff', fontFamily: 'var(--font-dota)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
        >
          {hero.localized_name}
        </span>
      </div>
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ boxShadow: `inset 0 0 0 2px ${attr?.color ?? '#fff'}` }}
      />
    </a>
  )
}

function HeroesPage() {
  const heroes = useQuery({ queryKey: ['heroes'], queryFn: () => opendota.heroStats() })
  const [attr, setAttr] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const data = heroes.data ?? []
  const filtered = data
    .filter((h) => !attr || h.primary_attr === attr)
    .filter((h) => h.localized_name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.localized_name.localeCompare(b.localized_name))

  return (
    <div className="py-4">
      {/* Title */}
      <div className="text-center mb-8">
        <h1
          className="text-[44px] leading-none font-bold uppercase"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '2px' }}
        >
          Choose Your Hero
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-[15px]" style={{ color: '#9a958a', fontFamily: 'var(--font-dota)' }}>
          From magical tacticians to fierce brutes and cunning rogues, Dota 2's hero pool is massive and
          limitlessly diverse. Unleash incredible abilities on your way to victory.
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="flex items-center gap-4 flex-wrap px-4 py-3 mb-6 rounded"
        style={{ background: 'rgba(10,10,12,0.7)', border: '1px solid #24222a' }}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}>
          Filter Heroes
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAttr(null)}
            className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm"
            style={{
              color: attr === null ? '#fff' : '#8a8578',
              background: attr === null ? '#2a2732' : 'transparent',
              border: '1px solid #2a2732',
              fontFamily: 'var(--font-dota)',
            }}
          >
            All
          </button>
          {ATTRS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAttr(attr === a.key ? null : a.key)}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm"
              style={{
                color: attr === a.key ? '#fff' : '#8a8578',
                background: attr === a.key ? '#2a2732' : 'transparent',
                border: `1px solid ${attr === a.key ? a.color : '#2a2732'}`,
                fontFamily: 'var(--font-dota)',
              }}
            >
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: a.color }} />
              {a.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="ml-auto text-[13px] px-3 py-1.5 rounded-sm outline-none"
          style={{ background: '#0a0a0c', border: '1px solid #2a2732', color: '#dcd6c8', fontFamily: 'var(--font-dota)', minWidth: 180 }}
        />
      </div>

      {heroes.isPending && (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      )}

      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-9">
        {filtered.map((h) => (
          <HeroCard key={h.id} hero={h} />
        ))}
      </div>

      {heroes.data && filtered.length === 0 && (
        <p className="text-center py-16 text-sm" style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}>
          No heroes match your filters.
        </p>
      )}
    </div>
  )
}
