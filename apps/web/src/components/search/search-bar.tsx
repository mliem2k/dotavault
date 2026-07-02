import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useRef, useState } from 'react'
import type { SearchResult } from 'types'
import { api } from '@/lib/eden'

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounce.current) clearTimeout(debounce.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    debounce.current = setTimeout(async () => {
      const { data } = await api.search.get({ query: { q: val } })
      if (data) {
        setResults(data.slice(0, 6))
        setOpen(true)
      }
    }, 300)
  }

  function select(accountId: number) {
    setOpen(false)
    setQuery('')
    navigate({ to: '/player/$accountId', params: { accountId: String(accountId) } })
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search player name or Steam ID…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card py-1">
          {results.map((r) => (
            <button
              key={r.account_id}
              onClick={() => select(r.account_id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/5"
            >
              <img src={r.avatarfull} alt="" className="h-7 w-7 rounded-full" />
              <span className="text-sm text-foreground">{r.personaname}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
