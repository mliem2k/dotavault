export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="border border-border" style={{ background: 'rgba(12,11,14,0.72)' }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 uppercase text-foreground font-display border-b border-border"
        style={{ fontSize: 20, fontWeight: 500, letterSpacing: '3px' }}
      >
        <span>{title}</span>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}
