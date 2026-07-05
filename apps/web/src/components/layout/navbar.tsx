import { Link } from '@tanstack/react-router'
import { useState } from 'react'

const NAV_LINKS = [
  { to: '/heroes', label: 'Heroes' },
  { to: '/meta', label: 'Meta' },
  { to: '/pro', label: 'Pro' },
  { to: '/leagues', label: 'Leagues' },
  { to: '/leaderboards', label: 'Leaderboards' },
] as const

function PlayButton({ compact }: { compact?: boolean }) {
  return (
    <a
      href="https://store.steampowered.com/app/570/Dota_2/"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-white uppercase transition-colors hover:border-white ${compact ? 'text-[13px] tracking-[1px]' : 'shrink-0 text-[13px] sm:text-[18px] tracking-[1px] sm:tracking-[3px]'}`}
      style={{
        margin: compact ? 0 : '10px 0 10px 20px',
        border: '3px solid rgba(255,255,255,0.314)',
        borderRadius: 5,
        transitionDuration: '0.2s',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        textDecoration: 'none',
        boxSizing: 'border-box',
        display: 'inline-block',
        width: compact ? '100%' : undefined,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: compact ? 'center' : undefined,
          gap: 10,
          padding: compact ? '12px 20px' : '15px 25px',
        }}
      >
        <img src="/steam_icon.svg" alt="" width="20" height="20" aria-hidden="true" />
        <span>Play for Free</span>
      </div>
    </a>
  )
}

function GitHubIcon() {
  return (
    // biome-ignore lint/a11y/useAnchorContent: aria-label provides the accessible label
    <a
      href="https://github.com/mliem2k/dotavault"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub repository"
      className="text-white transition-colors hover:text-[#c9a94a] shrink-0"
    >
      <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  )
}

export function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="relative z-50">
      <div className="mx-auto flex h-20 w-full max-w-[1800px] items-center px-4 sm:px-6 gap-4 sm:gap-8">
        <Link
          to="/"
          className="text-lg sm:text-2xl font-bold tracking-wide text-foreground shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          dotavault
        </Link>

        {/* Full link row: hidden below md, where it's replaced by the menu below */}
        <div
          className="hidden md:flex items-center gap-8 uppercase text-white text-[18px] tracking-[3px] flex-1"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}
        >
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-white transition-colors hover:text-[#c9a94a]">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4 sm:gap-8">
          <PlayButton />
          <GitHubIcon />
        </div>

        {/* Mobile: hamburger toggle, everything else lives in the dropdown */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="ml-auto flex md:hidden h-10 w-10 shrink-0 items-center justify-center text-white"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div
          className="md:hidden px-4 pb-5 pt-1 flex flex-col gap-1"
          style={{ background: 'rgba(8,10,12,0.97)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="py-3 uppercase text-white text-[16px] tracking-[2px] transition-colors hover:text-[#c9a94a]"
              style={{ fontFamily: 'var(--font-display)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-4">
            <div className="flex-1">
              <PlayButton compact />
            </div>
            <GitHubIcon />
          </div>
        </div>
      )}
    </nav>
  )
}
