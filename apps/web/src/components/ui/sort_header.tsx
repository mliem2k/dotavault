import type { CSSProperties } from 'react'
import type { SortDir } from '@/lib/sortable'

/* Clickable column header with an up/down arrow indicator, dimmed when this
   column isn't the active sort. Works inside a div-based header row or a
   <th> — pass className/style for column width and alignment. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  active,
  dir,
  onClick,
  className,
  style,
}: {
  label: string
  sortKey: K
  active: boolean
  dir: SortDir
  onClick: (k: K) => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      className={`inline-flex items-center gap-1 uppercase cursor-pointer hover:text-white transition-colors ${className ?? ''}`}
      style={{ color: active ? '#ffffff' : 'inherit', ...style }}
    >
      <span>{label}</span>
      <span style={{ opacity: active ? 1 : 0.3, fontSize: 9, lineHeight: 1 }}>
        {active && dir === 'asc' ? '▲' : '▼'}
      </span>
    </button>
  )
}
