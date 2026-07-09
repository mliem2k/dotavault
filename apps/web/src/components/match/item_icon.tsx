import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ItemConst } from 'types'
import { itemIconUrl, ITEM_CDN_FALLBACK } from '@/lib/utils'

function ItemTooltip({ meta, x, y }: { meta: ItemConst; x: number; y: number }) {
  // Clamp to viewport (tooltip ~ 300px wide)
  const W = 300
  const left = Math.min(x + 16, window.innerWidth - W - 12)
  const top = Math.min(y + 16, window.innerHeight - 260)
  // Only attribs with a curated `display` template are player-facing bonus lines;
  // the rest (model_scale, tooltip_*, images_count, …) are internal values.
  const attribs = (meta.attrib ?? []).filter((a) => a.display)

  return (
    <div
      className="pointer-events-none font-dota"
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: W,
        zIndex: 9999,
        background: '#0b0a08',
        border: '1px solid #3a352a',
        borderRadius: 4,
        boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
        padding: '10px 12px',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-[14px] font-bold" style={{ color: '#ece6d8' }}>
          {meta.dname ?? 'Unknown Item'}
        </span>
        {meta.cost != null && meta.cost > 0 && (
          <span className="flex items-center gap-1 text-[13px] font-bold shrink-0" style={{ color: '#d8bf6a' }}>
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
              <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">$</text>
            </svg>
            {meta.cost.toLocaleString()}
          </span>
        )}
      </div>

      {(meta.mc || meta.cd) && (
        <div className="flex items-center gap-3 mb-1.5 text-[11px]" style={{ color: '#8a8474' }}>
          {typeof meta.mc === 'number' && meta.mc > 0 && (
            <span style={{ color: '#5a8fc2' }}>Mana {meta.mc}</span>
          )}
          {typeof meta.cd === 'number' && meta.cd > 0 && (
            <span className="text-gold">Cooldown {meta.cd}s</span>
          )}
        </div>
      )}

      {attribs.length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          {attribs.map((a, i) => (
            <div key={i} className="text-[11px] leading-tight text-radiant">
              {(a.display ?? '').replace(/\{value\}/g, String(a.value)).trim()}
            </div>
          ))}
        </div>
      )}

      {meta.hint && meta.hint.length > 0 && (
        <div className="text-[11px] leading-snug mb-1" style={{ color: '#b8b2a4' }}>
          {meta.hint[0]}
        </div>
      )}

      {meta.notes && (
        <div className="text-[11px] leading-snug mb-1" style={{ color: '#8a8474' }}>
          {meta.notes}
        </div>
      )}

      {meta.lore && (
        <div className="text-[10px] leading-snug italic pt-1" style={{ color: '#5a5446', borderTop: '1px solid #241f16' }}>
          {meta.lore.length > 160 ? `${meta.lore.slice(0, 160)}…` : meta.lore}
        </div>
      )}
    </div>
  )
}

export function ItemIcon({
  name,
  meta,
  width,
  height,
  className = '',
  style,
}: {
  name: string | null
  meta: ItemConst | undefined
  width: number
  height: number
  className?: string
  style?: React.CSSProperties
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const box = (
    <div
      className={`rounded-sm overflow-hidden shrink-0 ${className}`}
      style={{ width, height, background: '#12100c', border: '1px solid #241f16', ...style }}
      tabIndex={name ? 0 : undefined}
      onMouseEnter={name ? (e) => setPos({ x: e.clientX, y: e.clientY }) : undefined}
      onMouseMove={name ? (e) => setPos({ x: e.clientX, y: e.clientY }) : undefined}
      onMouseLeave={() => setPos(null)}
      onFocus={name ? (e) => setPos({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().bottom }) : undefined}
      onBlur={() => setPos(null)}
    >
      {name ? (
        <img
          src={itemIconUrl(name)}
          alt={meta?.dname ?? name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Local asset first, Steam CDN if it 404s, dim if both fail.
            const img = e.currentTarget
            if (!img.src.includes('cdn.cloudflare')) {
              img.src = `${ITEM_CDN_FALLBACK}/${name}.png`
            } else {
              img.onerror = null
              img.style.opacity = '0.12'
            }
          }}
        />
      ) : null}
    </div>
  )

  if (!name) return box

  return (
    <>
      {box}
      {/* Portal to <body> so a transformed ancestor (e.g. the graphs timeline)
          can't hijack the fixed-position containing block. */}
      {pos && meta && createPortal(<ItemTooltip meta={meta} x={pos.x} y={pos.y} />, document.body)}
    </>
  )
}
