import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from 'types'
import { opendota } from '@/lib/opendota'

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
      setOpen(false)
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

  function resolveAccountId(val: string): string {
    if (/^\d+$/.test(val)) {
      const n = BigInt(val)
      const steam64base = BigInt('76561197960265728')
      if (n > steam64base) return String(n - steam64base)
      return val
    }
    return val
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const val = query.trim()
    if (!val) return
    if (/^\d+$/.test(val)) {
      setOpen(false)
      navigate({ to: '/player/$accountId', params: { accountId: resolveAccountId(val) } })
    } else if (results.length > 0) {
      select(results[0].account_id)
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
          placeholder="Search player name or Steam ID…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
        {/^\d+$/.test(query.trim()) && query.trim() && (
          <span className="text-xs text-muted flex-shrink-0">Press Enter</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card py-1 shadow-lg">
          {results.map((r) => (
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
          ))}
        </div>
      )}
    </div>
  )
}
