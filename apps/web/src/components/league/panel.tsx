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
    <div style={{ background: 'rgba(12,11,14,0.72)', border: '1px solid #24222a' }}>
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 uppercase"
        style={{ color: '#dcd6c8', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, letterSpacing: '3px', borderBottom: '1px solid #24222a' }}
      >
        <span>{title}</span>
        {action}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}
