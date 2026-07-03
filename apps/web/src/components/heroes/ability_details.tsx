import { useState } from 'react'
import type { AbilityConst } from 'types'

const CDN = 'https://cdn.cloudflare.steamstatic.com'
const VID = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/abilities'
const INNATE_ICON = 'https://cdn.steamstatic.com/apps/dota2/images/dota_react/icons/innate_icon.png'

function iconUrl(meta: AbilityConst | undefined): string {
  return meta?.img ? `${CDN}${meta.img}` : INNATE_ICON
}

function joinLv(v: string | string[] | number | number[] | boolean | undefined): string {
  if (v == null || v === '') return ''
  return Array.isArray(v) ? v.join(' / ') : String(v)
}

function InfoPair({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>{label}</span>
      <span className="text-[12px] font-semibold tabular-nums" style={{ color: valueColor ?? '#dcd6c8', fontFamily: 'var(--font-dota)' }}>{value}</span>
    </div>
  )
}

export function AbilityDetails({
  heroShort,
  abilityList,
  abilities,
}: {
  heroShort: string
  abilityList: string[]
  abilities: Record<string, AbilityConst>
}) {
  const [sel, setSel] = useState(0)
  const name = abilityList[sel] ?? abilityList[0]
  const a: AbilityConst | undefined = abilities[name]
  if (!name) return null

  const videoBase = `${VID}/${heroShort}/${name}`
  const attribs = (a?.attrib ?? []).filter((x) => x.header && x.value !== '' && x.value != null)

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Left: video + selector */}
      <div className="shrink-0">
        <div className="flex gap-2">
          <div className="relative overflow-hidden rounded" style={{ width: 440, maxWidth: '70vw', aspectRatio: '16 / 9', background: '#08080a', border: '1px solid #24222a' }}>
            <video
              key={name}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster={`${videoBase}.jpg`}
              className="w-full h-full object-cover"
            >
              <source type="video/webm" src={`${videoBase}.webm`} />
              <source type="video/mp4" src={`${videoBase}.mp4`} />
            </video>
          </div>

          {/* ability selector column */}
          <div className="flex flex-col gap-1.5">
            {abilityList.map((n, i) => (
              <button
                key={n}
                type="button"
                onClick={() => setSel(i)}
                className="shrink-0 overflow-hidden rounded-sm transition-all"
                style={{
                  width: 46,
                  height: 46,
                  border: i === sel ? '2px solid #c9a94a' : '2px solid transparent',
                  opacity: i === sel ? 1 : 0.55,
                }}
                title={abilities[n]?.dname ?? n}
              >
                <img
                  src={iconUrl(abilities[n])}
                  alt={abilities[n]?.dname ?? n}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const el = e.currentTarget
                    if (el.dataset.fb !== '1') { el.dataset.fb = '1'; el.src = INNATE_ICON }
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-3 mb-3">
          <img src={iconUrl(a)} alt="" className="w-12 h-12 rounded shrink-0" style={{ border: '1px solid #2a2620' }} />
          <div className="min-w-0">
            <div className="text-[18px] font-bold leading-tight" style={{ color: '#f0eae0', fontFamily: 'var(--font-dota)' }}>{a?.dname ?? name}</div>
            {a?.desc && <div className="text-[12px] leading-snug mt-0.5" style={{ color: '#a09a8a', fontFamily: 'var(--font-dota)' }}>{a.desc}</div>}
          </div>
        </div>

        {/* type row */}
        <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 pb-3" style={{ borderBottom: '1px solid #1c1810' }}>
          {a?.behavior && <InfoPair label="Ability:" value={joinLv(a.behavior)} valueColor="#9fb8d8" />}
          {a?.dmg_type && <InfoPair label="Damage:" value={String(a.dmg_type)} valueColor="#e8a070" />}
          {a?.bkbpierce != null && <InfoPair label="Pierces Immunity:" value={String(a.bkbpierce)} valueColor={String(a.bkbpierce) === 'Yes' ? '#8ec63f' : '#a09a8a'} />}
          {a?.dispellable != null && <InfoPair label="Dispellable:" value={String(a.dispellable)} valueColor="#a09a8a" />}
        </div>

        {/* attributes */}
        {attribs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mb-3">
            {attribs.map((x, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-wide" style={{ color: '#77715f', fontFamily: 'var(--font-dota)' }}>{(x.header ?? '').replace(/:$/, '')}</span>
                <span className="text-[12px] font-semibold tabular-nums" style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}>{joinLv(x.value)}</span>
              </div>
            ))}
          </div>
        )}

        {/* cooldown / mana */}
        <div className="flex items-center gap-5 mb-3">
          {a?.cd != null && joinLv(a.cd) !== '' && joinLv(a.cd) !== '0' && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center rounded-full text-[10px] font-bold" style={{ width: 18, height: 18, background: '#2a2312', color: '#c9a94a' }}>⏱</span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}>{joinLv(a.cd)}</span>
            </div>
          )}
          {a?.mc != null && joinLv(a.mc as string | string[]) !== '' && joinLv(a.mc as string | string[]) !== '0' && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center rounded-full text-[10px] font-bold" style={{ width: 18, height: 18, background: '#12233a', color: '#5a8fc2' }}>◆</span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: '#5a8fc2', fontFamily: 'var(--font-dota)' }}>{joinLv(a.mc as string | string[])}</span>
            </div>
          )}
        </div>

        {a?.lore && (
          <div className="text-[12px] italic leading-snug" style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}>{a.lore}</div>
        )}
      </div>
    </div>
  )
}
