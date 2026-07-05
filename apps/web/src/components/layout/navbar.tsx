import { Link } from '@tanstack/react-router'

export function Navbar() {
  return (
    <nav className="relative z-50">
      <div className="mx-auto flex h-20 w-full max-w-[1800px] items-center px-6 gap-8">
        <Link
          to="/"
          className="text-lg sm:text-2xl font-bold tracking-wide text-foreground shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          dotavault
        </Link>
        <div
          className="flex items-center gap-4 sm:gap-8 uppercase text-white text-[13px] sm:text-[18px] tracking-[1px] sm:tracking-[3px] flex-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
          }}
        >
          <Link to="/heroes" className="text-white transition-colors hover:text-[#c9a94a]">
            Heroes
          </Link>
          <Link to="/meta" className="text-white transition-colors hover:text-[#c9a94a]">
            Meta
          </Link>
          <Link to="/pro" className="text-white transition-colors hover:text-[#c9a94a]">
            Pro
          </Link>
          <Link to="/leagues" className="text-white transition-colors hover:text-[#c9a94a]">
            Leagues
          </Link>
          <Link to="/leaderboards" className="text-white transition-colors hover:text-[#c9a94a]">
            Leaderboards
          </Link>
        </div>
        <a
          href="https://store.steampowered.com/app/570/Dota_2/"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-white uppercase transition-colors hover:border-white text-[13px] sm:text-[18px] tracking-[1px] sm:tracking-[3px]"
          style={{
            margin: '10px 0 10px 20px',
            border: '3px solid rgba(255,255,255,0.314)',
            borderRadius: 5,
            transitionDuration: '0.2s',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, padding: '15px 25px' }}>
            <img src="/steam_icon.svg" alt="" width="20" height="20" aria-hidden="true" />
            <span>Play for Free</span>
          </div>
        </a>
        {/* biome-ignore lint/a11y/useAnchorContent: aria-label provides the accessible label */}
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
      </div>
    </nav>
  )
}
