import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ItemConst } from 'types'
import { ITEM_CDN_FALLBACK, itemIconUrl } from '@/lib/utils'

// Enhancement stat values are slash-separated per tier (e.g. "7 / 15 / 23 /
// 31"); badgeTier (1-indexed, from neutralItemAtTime's enhancementTier)
// picks the one that currently applies. Values without tiers (a plain
// number, or a string with nothing to split) pass through unchanged.
function pickTierValue(value: string | number, tier: number | undefined): string {
  if (typeof value === 'number' || !tier) return String(value)
  const parts = value.split('/').map((v) => v.trim())
  if (parts.length <= 1) return value
  return parts[Math.min(tier, parts.length) - 1]
}

function ItemTooltip({
  meta,
  x,
  y,
  badge,
  badgeMeta,
  badgeTier,
}: {
  meta: ItemConst
  x: number
  y: number
  badge?: string
  badgeMeta?: ItemConst
  badgeTier?: number
}) {
  // Clamp to viewport (tooltip ~ 300px wide)
  const W = 300
  const left = Math.min(x + 16, window.innerWidth - W - 12)
  const top = Math.min(y + 16, window.innerHeight - 260)
  // Only attribs with a curated `display` template are player-facing bonus lines;
  // the rest (model_scale, tooltip_*, images_count, …) are internal values.
  const attribs = (meta.attrib ?? []).filter((a) => a.display)
  const badgeAttribs = (badgeMeta?.attrib ?? []).filter((a) => a.display)

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
      {badge && (
        <div className="mb-1.5 pb-1.5" style={{ borderBottom: '1px solid #3a352a' }}>
          <div
            className="text-[11px] font-bold uppercase"
            style={{ color: '#d4af37', letterSpacing: '1px' }}
          >
            {badge} Enhancement
          </div>
          {badgeAttribs.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {badgeAttribs.map((a) => (
                <div key={a.key} className="text-[11px] leading-tight text-radiant">
                  {(a.display ?? '')
                    .replace(/\{value\}/g, pickTierValue(a.value, badgeTier))
                    .trim()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="text-[14px] font-bold" style={{ color: '#ece6d8' }}>
          {meta.dname ?? 'Unknown Item'}
        </span>
        {meta.cost != null && meta.cost > 0 && (
          <span
            className="flex items-center gap-1 text-[13px] font-bold shrink-0"
            style={{ color: '#d8bf6a' }}
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <title>Gold cost</title>
              <circle cx="5" cy="5" r="4.5" fill="#c8961e" />
              <text x="5" y="7.5" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="bold">
                $
              </text>
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

      {(meta.abilities ?? []).map((ab, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed ability-list position, not reorderable
          key={i}
          className="mb-1.5"
        >
          {ab.title && (
            <div
              className="text-[12px] font-bold uppercase mb-0.5"
              style={{
                color: ab.type === 'active' ? '#f2c94c' : '#8fbf3f',
                letterSpacing: '0.5px',
              }}
            >
              {ab.title}
            </div>
          )}
          {ab.description && (
            <div
              className="text-[11px] leading-snug whitespace-pre-line"
              style={{ color: '#cfd4d8' }}
            >
              {ab.description}
            </div>
          )}
        </div>
      ))}

      {attribs.length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          {attribs.map((a) => (
            <div key={a.key} className="text-[11px] leading-tight text-radiant">
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
        <div
          className="text-[10px] leading-snug italic pt-1"
          style={{ color: '#5a5446', borderTop: '1px solid #241f16' }}
        >
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
  badge,
  badgeMeta,
  badgeTier,
}: {
  name: string | null
  meta: ItemConst | undefined
  width: number
  height: number
  className?: string
  style?: React.CSSProperties
  // Extra callout line shown inside this item's own tooltip (e.g. a neutral
  // item's enhancement tier) instead of a second, separately-triggered
  // tooltip stacking on top of it.
  badge?: string
  // The enhancement's own item-constant entry, so its stat bonuses (attrib)
  // can render under the badge line.
  badgeMeta?: ItemConst
  // 1-indexed tier to pick out of badgeMeta's slash-separated attrib
  // values; omit to show the full tiered progression (unknown current tier).
  badgeTier?: number
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const boxClassName = `rounded-sm overflow-hidden shrink-0 ${className}`
  const boxStyle = { width, height, background: '#12100c', border: '1px solid #241f16', ...style }

  const box = name ? (
    <button
      type="button"
      className={boxClassName}
      style={boxStyle}
      onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setPos(null)}
      onFocus={(e) =>
        setPos({
          x: e.currentTarget.getBoundingClientRect().left,
          y: e.currentTarget.getBoundingClientRect().bottom,
        })
      }
      onBlur={() => setPos(null)}
    >
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
    </button>
  ) : (
    <div className={boxClassName} style={boxStyle} />
  )

  if (!name) return box

  return (
    <>
      {box}
      {/* Portal to <body> so a transformed ancestor (e.g. the graphs timeline)
          can't hijack the fixed-position containing block. */}
      {pos &&
        meta &&
        createPortal(
          <ItemTooltip
            meta={meta}
            x={pos.x}
            y={pos.y}
            badge={badge}
            badgeMeta={badgeMeta}
            badgeTier={badgeTier}
          />,
          document.body,
        )}
    </>
  )
}
