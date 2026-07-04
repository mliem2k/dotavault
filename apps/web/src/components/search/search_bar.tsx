import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, Swords, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from 'types'
import { opendota } from '@/lib/opendota'
import { resolveVanitySteamId, STEAM64_BASE } from '@/lib/steam'

type Destination = { kind: 'player'; id: string } | { kind: 'match'; id: string }

type Parsed =
  | { type: 'resolved'; dest: Destination; label: string }
  | { type: 'vanity'; url: string }
  | { type: 'search'; query: string }

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
        const id = await resolveVanitySteamId(p.url)
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
    <div className="relative w-full max-w-3xl">
      <div
        className="flex items-center gap-3 px-5"
        style={{
          background: 'rgba(8,8,12,0.9)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.6)',
          height: 64,
        }}
      >
        <Search className="h-5 w-5 flex-shrink-0" style={{ color: '#5a6070' }} />
        <input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, Steam ID, match ID, or profile URL"
          className="w-full bg-transparent outline-none"
          style={{
            fontFamily: 'Radiance, "Noto Sans", sans-serif',
            fontSize: 17,
            color: '#e8e4d8',
            letterSpacing: '0.01em',
          }}
        />
        {resolving
          ? <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#5a6070' }} />
          : <kbd style={{ fontFamily: 'inherit', fontSize: 11, color: '#4a4a50', border: '1px solid #2a2a30', padding: '2px 6px', borderRadius: 3, flexShrink: 0 }}>Enter</kbd>
        }
      </div>

      {open && (
        <div
          className="absolute top-full z-50 mt-1 w-full py-1"
          style={{ background: '#08080c', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 48px rgba(0,0,0,0.8)' }}
        >
          {/* Deterministic resolved entry */}
          {parsed?.type === 'resolved' && (
            <button
              onClick={() => go(parsed.dest)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.04]"
            >
              {parsed.dest.kind === 'match'
                ? <Swords className="h-4 w-4 flex-shrink-0" style={{ color: '#c9a94a' }} />
                : <User className="h-4 w-4 flex-shrink-0" style={{ color: '#c9a94a' }} />}
              <div>
                <div style={{ fontSize: 14, color: '#e8e4d8', fontFamily: 'Radiance, "Noto Sans", sans-serif' }}>
                  {parsed.dest.kind === 'match' ? 'View Match' : 'View Player'}
                </div>
                <div className="font-mono" style={{ fontSize: 12, color: '#5a6070', marginTop: 1 }}>#{parsed.dest.id}</div>
              </div>
            </button>
          )}

          {/* Vanity URL resolved entry */}
          {parsed?.type === 'vanity' && vanityResult && (
            <button
              onClick={() => go({ kind: 'player', id: vanityResult })}
              className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.04]"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <User className="h-4 w-4 flex-shrink-0" style={{ color: '#c9a94a' }} />
              <div>
                <div style={{ fontSize: 14, color: '#e8e4d8', fontFamily: 'Radiance, "Noto Sans", sans-serif' }}>Steam Profile</div>
                <div className="font-mono" style={{ fontSize: 12, color: '#5a6070', marginTop: 1 }}>#{vanityResult} · {parsed.url}</div>
              </div>
            </button>
          )}

          {/* Name search results */}
          {results.map((r) => (
            <button
              key={r.account_id}
              onClick={() => go({ kind: 'player', id: String(r.account_id) })}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-white/[0.04]"
            >
              <img
                src={r.avatarfull}
                alt=""
                className="h-8 w-8 rounded-full object-cover flex-shrink-0"
              />
              <span style={{ fontSize: 15, color: '#e8e4d8', fontFamily: 'Radiance, "Noto Sans", sans-serif' }}>{r.personaname}</span>
            </button>
          ))}

          {/* Vanity resolving state with no results yet */}
          {parsed?.type === 'vanity' && resolving && !vanityResult && results.length === 0 && (
            <div className="px-5 py-3" style={{ fontSize: 13, color: '#5a6070', fontFamily: 'Radiance, "Noto Sans", sans-serif' }}>Resolving Steam ID…</div>
          )}
        </div>
      )}
    </div>
  )
}
