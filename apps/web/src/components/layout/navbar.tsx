import { Link } from '@tanstack/react-router'

export function Navbar() {
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="font-mono text-sm font-semibold tracking-tight text-foreground">
          dotavault
        </Link>
        <div className="flex items-center gap-6 text-sm font-semibold uppercase tracking-wide text-white">
          <Link to="/heroes" className="text-white transition-colors hover:text-[#c9a94a]">
            Heroes
          </Link>
          <Link to="/meta" className="text-white transition-colors hover:text-[#c9a94a]">
            Meta
          </Link>
          <Link to="/pro" className="text-white transition-colors hover:text-[#c9a94a]">
            Pro
          </Link>
        </div>
      </div>
    </nav>
  )
}
