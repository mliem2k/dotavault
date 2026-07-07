import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-4 w-4 motion-safe:animate-spin rounded-full border-2 border-border border-t-foreground',
        className
      )}
    />
  )
}
