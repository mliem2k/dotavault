import { cn } from '@/lib/utils'

type BadgeVariant = 'win' | 'loss' | 'radiant' | 'dire' | 'default'

const variants: Record<BadgeVariant, string> = {
  win: 'bg-radiant/10 text-radiant border-radiant/20',
  loss: 'bg-dire/10 text-dire border-dire/20',
  radiant: 'bg-radiant/10 text-radiant border-radiant/20',
  dire: 'bg-dire/10 text-dire border-dire/20',
  default: 'bg-card text-muted border-border',
}

export function Badge({
  variant = 'default',
  children,
  className,
}: {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
