import { Link } from '@tanstack/react-router'

export function Navbar() {
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="font-mono text-sm font-semibold tracking-tight text-foreground">
          dotavault
        </Link>
        <div className="flex items-center gap-6 text-sm text-muted">
          <Link to="/heroes" className="transition-colors hover:text-foreground">
            Heroes
          </Link>
          <Link to="/pro" className="transition-colors hover:text-foreground">
            Pro
          </Link>
        </div>
      </div>
    </nav>
  )
}
