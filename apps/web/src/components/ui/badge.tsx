import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
  {
    variants: {
      variant: {
        win: 'text-radiant border-radiant/40',
        loss: 'text-dire border-dire/40',
        radiant: 'text-radiant border-radiant/40',
        dire: 'text-dire border-dire/40',
        pro: 'text-gold border-gold/50',
        private: 'text-muted border-muted',
        default: 'text-muted border-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({
  variant,
  children,
  className,
  title,
}: VariantProps<typeof badgeVariants> & {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span title={title} className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  )
}
