import { useNavigate } from '@tanstack/react-router'
import { Search, Swords, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from 'types'
import { opendota } from '@/lib/opendota'

type NumericKind = 'match' | 'player'

function resolveId(val: string): { type: NumericKind; id: string } {
  const n = BigInt(val)
  const steam64base = BigInt('76561197960265728')
  const maxAccountId = BigInt('4294967295')
  if (n > steam64base) return { type: 'player', id: String(n - steam64base) }
  if (n > maxAccountId) return { type: 'match', id: val }
  return { type: 'player', id: val }
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current)
    }
  }, [])

  const trimmed = query.trim()
  const isNumeric = /^\d+$/.test(trimmed)
  const resolved = isNumeric && trimmed ? resolveId(trimmed) : null

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounce.current) clearTimeout(debounce.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    if (/^\d+$/.test(val.trim())) {
      setResults([])
      setOpen(true)
      return
    }
    debounce.current = setTimeout(async () => {
      try {
        const res = await opendota.search(val)
        setResults(res.slice(0, 6))
        setOpen(res.length > 0)
      } catch {
        setResults([])
      }
    }, 300)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key !== 'Enter') return
    if (!trimmed) return
    if (isNumeric && resolved) {
      setOpen(false)
      navigateTo(resolved)
    } else if (results.length > 0) {
      select(results[0].account_id)
    }
  }

  function navigateTo(r: { type: NumericKind; id: string }) {
    setOpen(false)
    setQuery('')
    if (r.type === 'match') {
      navigate({ to: '/match/$matchId', params: { matchId: r.id } })
    } else {
      navigate({ to: '/player/$accountId', params: { accountId: r.id } })
    }
  }

  function select(accountId: number) {
    setOpen(false)
    setQuery('')
    navigate({ to: '/player/$accountId', params: { accountId: String(accountId) } })
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted flex-shrink-0" />
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search player name, Steam ID, or match ID…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card py-1 shadow-lg">
          {isNumeric && resolved ? (
            <button
              onClick={() => navigateTo(resolved)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
            >
              {resolved.type === 'match' ? (
                <Swords className="h-4 w-4 text-accent flex-shrink-0" />
              ) : (
                <User className="h-4 w-4 text-accent flex-shrink-0" />
              )}
              <div>
                <div className="text-sm font-medium">
                  {resolved.type === 'match' ? 'View Match' : 'View Player'}
                </div>
                <div className="font-mono text-xs text-muted">#{resolved.id}</div>
              </div>
            </button>
          ) : (
            results.map((r) => (
              <button
                key={r.account_id}
                onClick={() => select(r.account_id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
              >
                <img
                  src={r.avatarfull}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover flex-shrink-0"
                />
                <span className="text-sm text-foreground">{r.personaname}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
