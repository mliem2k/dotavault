import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, Swords, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from 'types'
import { opendota } from '@/lib/opendota'

type Destination = { kind: 'player'; id: string } | { kind: 'match'; id: string }

type Parsed =
  | { type: 'resolved'; dest: Destination; label: string }
  | { type: 'vanity'; url: string }
  | { type: 'search'; query: string }

const STEAM64_BASE = BigInt('76561197960265728')
const MAX_ACCOUNT_ID = BigInt('4294967295')

function numericDest(s: string): Destination {
  try {
    const n = BigInt(s)
    if (n > STEAM64_BASE) return { kind: 'player', id: String(n - STEAM64_BASE) }
    if (n > MAX_ACCOUNT_ID) return { kind: 'match', id: s }
    return { kind: 'player', id: s }
  } catch {
    return { kind: 'player', id: s }
  }
}

function parseInput(raw: string): Parsed | null {
  const s = raw.trim()
  if (!s) return null

  // STEAM_0:Y:Z
  const steamFmt = s.match(/^STEAM_\d:(\d):(\d+)$/i)
  if (steamFmt) {
    const accountId = String(BigInt(steamFmt[2]) * 2n + BigInt(steamFmt[1]))
    return { type: 'resolved', dest: { kind: 'player', id: accountId }, label: `Account #${accountId}` }
  }

  // steamcommunity.com/profiles/<steam64>
  const profileUrl = s.match(/steamcommunity\.com\/profiles\/(\d+)/i)
  if (profileUrl) {
    const dest = numericDest(profileUrl[1])
    return { type: 'resolved', dest, label: dest.kind === 'player' ? `Player #${dest.id}` : `Match #${dest.id}` }
  }

  // steamcommunity.com/id/<vanity>
  const communityId = s.match(/steamcommunity\.com\/id\/([^\/\s?#]+)/i)
  if (communityId) return { type: 'vanity', url: communityId[1] }

  // dotabuff / dotamax / opendota / stratz player URLs
  const trackerUrl = s.match(/(?:dotabuff|dotamax|opendota|stratz)\.com\/(?:player[s]?\/(?:detail\/)?)?(\d+)/i)
  if (trackerUrl) {
    const dest = numericDest(trackerUrl[1])
    return { type: 'resolved', dest, label: dest.kind === 'player' ? `Player #${dest.id}` : `Match #${dest.id}` }
  }

  // Any URL with a trailing number segment
  if (s.startsWith('http')) {
    const trailingNum = s.match(/\/(\d{5,})\/?(?:[?#].*)?$/)
    if (trailingNum) {
      const dest = numericDest(trailingNum[1])
      return { type: 'resolved', dest, label: dest.kind === 'player' ? `Player #${dest.id}` : `Match #${dest.id}` }
    }
  }

  // Pure number
  if (/^\d+$/.test(s)) {
    const dest = numericDest(s)
    return { type: 'resolved', dest, label: dest.kind === 'player' ? `Player #${dest.id}` : `Match #${dest.id}` }
  }

  // Single word (no spaces, no dots) → try as Steam vanity URL
  if (!s.includes(' ') && !s.includes('.')) {
    return { type: 'vanity', url: s }
  }

  return { type: 'search', query: s }
}

async function resolveVanity(vanity: string): Promise<string | null> {
  try {
    const res = await fetch(`https://playerdb.co/api/player/steam/${encodeURIComponent(vanity)}`)
    if (!res.ok) return null
    const data = await res.json()
    const steam64 = data?.data?.player?.id
    if (!steam64) return null
    return String(BigInt(steam64) - STEAM64_BASE)
  } catch {
    return null
  }
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [vanityResult, setVanityResult] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vanityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentVanity = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
      if (vanityDebounce.current) clearTimeout(vanityDebounce.current)
    }
  }, [])

  const trimmed = query.trim()
  const parsed = trimmed ? parseInput(trimmed) : null

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    setVanityResult(null)
    setResults([])
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (vanityDebounce.current) clearTimeout(vanityDebounce.current)

    const t = val.trim()
    if (!t) { setOpen(false); return }

    const p = parseInput(t)
    if (!p) { setOpen(false); return }
    setOpen(true)

    if (p.type === 'vanity') {
      // Run name search + vanity resolution in parallel
      setResolving(true)
      currentVanity.current = p.url
      vanityDebounce.current = setTimeout(async () => {
        const id = await resolveVanity(p.url)
        if (currentVanity.current === p.url) {
          setVanityResult(id)
          setResolving(false)
        }
      }, 400)
      searchDebounce.current = setTimeout(async () => {
        try {
          const res = await opendota.search(t)
          setResults(res.slice(0, 5))
        } catch {
          setResults([])
        }
      }, 300)
    } else if (p.type === 'search') {
      searchDebounce.current = setTimeout(async () => {
        try {
          const res = await opendota.search(t)
          setResults(res.slice(0, 6))
        } catch {
          setResults([])
        }
      }, 300)
    }
  }

  function go(dest: Destination) {
    setOpen(false)
    setQuery('')
    setResults([])
    setVanityResult(null)
    if (dest.kind === 'match') {
      navigate({ to: '/match/$matchId', params: { matchId: dest.id } })
    } else {
      navigate({ to: '/player/$accountId', params: { accountId: dest.id } })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key !== 'Enter' || !trimmed) return
    if (!parsed) return

    if (parsed.type === 'resolved') {
      go(parsed.dest)
    } else if (parsed.type === 'vanity' && vanityResult) {
      go({ kind: 'player', id: vanityResult })
    } else if (results.length > 0) {
      go({ kind: 'player', id: String(results[0].account_id) })
    }
  }

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
        <Search className="h-4 w-4 text-muted flex-shrink-0" />
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Name, Steam ID, match ID, profile URL…"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
        {resolving && <Loader2 className="h-3.5 w-3.5 text-muted animate-spin flex-shrink-0" />}
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-border bg-card py-1 shadow-lg">
          {/* Deterministic resolved entry */}
          {parsed?.type === 'resolved' && (
            <button
              onClick={() => go(parsed.dest)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5"
            >
              {parsed.dest.kind === 'match'
                ? <Swords className="h-4 w-4 text-accent flex-shrink-0" />
                : <User className="h-4 w-4 text-accent flex-shrink-0" />}
              <div>
                <div className="text-sm font-medium">
                  {parsed.dest.kind === 'match' ? 'View Match' : 'View Player'}
                </div>
                <div className="font-mono text-xs text-muted">#{parsed.dest.id}</div>
              </div>
            </button>
          )}

          {/* Vanity URL resolved entry */}
          {parsed?.type === 'vanity' && vanityResult && (
            <button
              onClick={() => go({ kind: 'player', id: vanityResult })}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 border-b border-border/30"
            >
              <User className="h-4 w-4 text-accent flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">Steam Profile</div>
                <div className="font-mono text-xs text-muted">#{vanityResult} · {parsed.url}</div>
              </div>
            </button>
          )}

          {/* Name search results */}
          {results.map((r) => (
            <button
              key={r.account_id}
              onClick={() => go({ kind: 'player', id: String(r.account_id) })}
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

          {/* Vanity resolving state with no results yet */}
          {parsed?.type === 'vanity' && resolving && !vanityResult && results.length === 0 && (
            <div className="px-3 py-2.5 text-xs text-muted">Resolving Steam ID…</div>
          )}
        </div>
      )}
    </div>
  )
}
