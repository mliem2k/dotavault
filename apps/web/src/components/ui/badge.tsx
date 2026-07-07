import { cn } from '@/lib/utils'

type BadgeVariant = 'win' | 'loss' | 'radiant' | 'dire' | 'pro' | 'private' | 'default'

const variants: Record<BadgeVariant, string> = {
  win: 'text-radiant border-radiant/40',
  loss: 'text-dire border-dire/40',
  radiant: 'text-radiant border-radiant/40',
  dire: 'text-dire border-dire/40',
  pro: 'text-gold border-gold/50',
  private: 'text-muted border-muted',
  default: 'text-muted border-muted',
}

export function Badge({
  variant = 'default',
  children,
  className,
  title,
}: {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
