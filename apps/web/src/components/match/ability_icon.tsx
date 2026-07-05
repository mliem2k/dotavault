import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { AbilityConst } from 'types'
import { INNATE_ICON_CDN, TALENTS_ICON_CDN, abilityIconCdn, abilityIconUrl, dotaIconUrl } from '@/lib/utils'

// Innate abilities don't ship a per-ability icon — fall back to the generic one.
const INNATE_ICON = dotaIconUrl('innate_icon')

function cleanTalent(name: string): string {
  // Talent dnames embed unresolved templates like "{s:bonus_X}" — strip them.
  return name.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
}

function joinLevels(v: string | string[] | undefined): string {
  if (v == null) return ''
  return Array.isArray(v) ? v.join(' / ') : String(v)
}

function AbilityTooltip({ meta, isTalent, x, y }: { meta: AbilityConst; isTalent: boolean; x: number; y: number }) {
  const W = 300
  const left = Math.min(x + 16, window.innerWidth - W - 12)
  const top = Math.min(y + 16, window.innerHeight - 240)
  const attribs = (meta.attrib ?? []).slice(0, 6)
  const behavior = joinLevels(meta.behavior)

  return (
    <div
      className="pointer-events-none"
      style={{
        position: 'fixed',
        left: Math.max(8, left),
        top: Math.max(8, top),
        width: W,
        zIndex: 9999,
        background: '#0b0a08',
        border: `1px solid ${isTalent ? '#3a5a1a' : '#3a352a'}`,
        borderRadius: 4,
        boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
        padding: '10px 12px',
        fontFamily: 'var(--font-dota)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[14px] font-bold" style={{ color: '#ece6d8' }}>
          {isTalent ? cleanTalent(meta.dname ?? 'Talent') : (meta.dname ?? 'Ability')}
        </span>
        {isTalent && (
          <span className="text-[11px] font-bold uppercase tracking-widest shrink-0" style={{ color: '#8ec63f' }}>
            Talent
          </span>
        )}
      </div>

      {!isTalent && (behavior || meta.dmg_type) && (
        <div className="flex items-center gap-2 mb-1.5 text-[10px] uppercase tracking-wide">
          {behavior && <span style={{ color: '#8a8474' }}>{behavior}</span>}
          {meta.dmg_type && <span style={{ color: '#e8a070' }}>{meta.dmg_type}</span>}
        </div>
      )}

      {(meta.mc != null && meta.mc !== 0 && meta.mc !== false) || meta.cd ? (
        <div className="flex items-center gap-3 mb-1.5 text-[11px]">
          {meta.mc != null && meta.mc !== 0 && meta.mc !== false && (
            <span style={{ color: '#5a8fc2' }}>Mana {joinLevels(meta.mc as string | string[])}</span>
          )}
          {meta.cd != null && meta.cd !== 0 && (
            <span style={{ color: '#c9a94a' }}>CD {joinLevels(meta.cd as string | string[])}s</span>
          )}
        </div>
      ) : null}

      {meta.desc && (
        <div className="text-[11px] leading-snug mb-1.5" style={{ color: '#b8b2a4' }}>
          {meta.desc.length > 220 ? `${meta.desc.slice(0, 220)}…` : meta.desc}
        </div>
      )}

      {attribs.length > 0 && (
        <div className="space-y-0.5">
          {attribs.map((a, i) => (
            <div key={i} className="flex justify-between gap-3 text-[10px] leading-tight">
              <span className="uppercase" style={{ color: '#77715f' }}>
                {(a.header ?? a.key).replace(/:$/, '')}
              </span>
              <span className="tabular-nums shrink-0" style={{ color: '#8ec63f' }}>{joinLevels(a.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function AbilityIcon({
  name,
  meta,
  isTalent,
  level,
  size = 26,
  onLoadError,
}: {
  name: string
  meta: AbilityConst | undefined
  isTalent: boolean
  level: number
  size?: number
  onLoadError?: () => void
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const img = !isTalent ? abilityIconUrl(name) : null

  return (
    <>
      <div
        className="shrink-0 rounded-sm overflow-hidden flex items-center justify-center"
        style={{
          width: size,
          height: size,
          background: isTalent ? '#1a2810' : '#12100c',
          border: `1px solid ${isTalent ? '#3a5a1a' : '#241f16'}`,
        }}
        onMouseEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setPos(null)}
      >
        {img ? (
          <img
            src={img}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget
              const step = el.dataset.step ?? '0'
              if (step === '0') { el.dataset.step = '1'; el.src = abilityIconCdn(name, meta?.img) }
              else if (step === '1') { el.dataset.step = '2'; el.src = INNATE_ICON; onLoadError?.() }
              else if (step === '2') { el.dataset.step = '3'; el.src = INNATE_ICON_CDN }
              else { el.style.opacity = '0.2' }
            }}
          />
        ) : (
          <img
            src={TALENTS_ICON_CDN}
            alt="Talent"
            style={{ width: '78%', height: '78%', objectFit: 'contain' }}
          />
        )}
      </div>
      {pos && meta && createPortal(<AbilityTooltip meta={meta} isTalent={isTalent} x={pos.x} y={pos.y} />, document.body)}
    </>
  )
}
