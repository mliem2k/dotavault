import { useState } from 'react'
import type { AbilityConst, AghsDesc } from 'types'
import {
  AGHS_SCEPTER_CDN,
  AGHS_SHARD_CDN,
  abilityIconCdn,
  abilityIconUrl,
  cdnFallback,
  dotaIconUrl,
} from '@/lib/utils'

const VID = 'https://cdn.steamstatic.com/apps/dota2/videos/dota_react/abilities'
const INNATE_ICON = dotaIconUrl('innate_icon')
const SCEPTER_BADGE = dotaIconUrl('aghs_scepter')
const SHARD_BADGE = dotaIconUrl('aghs_shard')

function joinLv(v: string | string[] | number | number[] | boolean | undefined): string {
  if (v == null || v === '') return ''
  return Array.isArray(v) ? v.join(' / ') : String(v)
}

type Entry = { base: string; aghs?: 'scepter' | 'shard'; aghsDesc?: string }

export function AbilityDetails({
  heroShort,
  abilityList,
  abilities,
  aghs,
}: {
  heroShort: string
  abilityList: string[]
  abilities: Record<string, AbilityConst>
  aghs?: AghsDesc
}) {
  const entries: Entry[] = abilityList.map((base) => ({ base }))
  if (aghs?.has_scepter) {
    const base =
      abilityList.find((n) => abilities[n]?.dname === aghs.scepter_skill_name) ?? abilityList[0]
    if (base) entries.push({ base, aghs: 'scepter', aghsDesc: aghs.scepter_desc })
  }
  if (aghs?.has_shard) {
    const base =
      abilityList.find((n) => abilities[n]?.dname === aghs.shard_skill_name) ?? abilityList[0]
    if (base) entries.push({ base, aghs: 'shard', aghsDesc: aghs.shard_desc })
  }

  const [sel, setSel] = useState(0)
  const entry = entries[sel] ?? entries[0]
  if (!entry) return null
  const name = entry.base
  const a: AbilityConst | undefined = abilities[name]
  const videoBase = `${VID}/${heroShort}/${name}`
  const attribs = (a?.attrib ?? []).filter((x) => x.header && x.value !== '' && x.value != null)
  const hasCd = a?.cd != null && joinLv(a.cd) !== '' && joinLv(a.cd) !== '0'
  const hasMc =
    a?.mc != null &&
    joinLv(a.mc as string | string[]) !== '' &&
    joinLv(a.mc as string | string[]) !== '0'

  function AbilityIcon({ entry: e, size }: { entry: Entry; size: number }) {
    return (
      <img
        src={abilityIconUrl(e.base)}
        alt=""
        style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
        onError={(ev) => {
          const el = ev.currentTarget
          const s = el.dataset.step ?? '0'
          if (s === '0') {
            el.dataset.step = '1'
            el.src = abilityIconCdn(e.base, abilities[e.base]?.img)
          } else if (s === '1') {
            el.dataset.step = '2'
            el.src = INNATE_ICON
          }
        }}
      />
    )
  }

  return (
    // Two-column: video+selector on left, dark details panel on right
    <div className="flex flex-col lg:flex-row gap-0">
      {/* Left: video with selector row below */}
      <div className="shrink-0 flex flex-col" style={{ width: '100%', maxWidth: 700 }}>
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: '16 / 9', background: '#08080a' }}
        >
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

        {/* Ability selector: horizontal row below video */}
        <div className="flex items-center gap-1 px-2 py-2" style={{ background: '#0c0b0f' }}>
          {entries.map((e, i) => (
            <button
              key={`${e.base}-${e.aghs ?? 'base'}`}
              type="button"
              onClick={() => setSel(i)}
              className="relative shrink-0 overflow-hidden transition-opacity"
              style={{
                width: 64,
                height: 64,
                border: i === sel ? '2px solid #c9a94a' : '2px solid rgba(255,255,255,0.08)',
                opacity: i === sel ? 1 : 0.5,
              }}
              title={abilities[e.base]?.dname ?? e.base}
            >
              <AbilityIcon entry={e} size={64} />
              {e.aghs && (
                <img
                  src={e.aghs === 'scepter' ? SCEPTER_BADGE : SHARD_BADGE}
                  alt={e.aghs}
                  className="absolute bottom-0 right-0"
                  style={{
                    width: 18,
                    height: 18,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
                  }}
                  onError={cdnFallback(e.aghs === 'scepter' ? AGHS_SCEPTER_CDN : AGHS_SHARD_CDN)}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: dark details panel */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: '#0c0b0f' }}>
        {/* Name + icon + description */}
        <div className="flex items-start gap-4 p-5" style={{ borderBottom: '1px solid #1c1810' }}>
          <div className="shrink-0" style={{ border: '1px solid #2a2620' }}>
            <AbilityIcon entry={entry} size={84} />
            {entry.aghs && (
              <div
                className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1 py-0.5"
                style={{
                  background: entry.aghs === 'scepter' ? '#12233a' : '#1a2338',
                  color: entry.aghs === 'scepter' ? '#5a8fc2' : '#8fb0e0',
                }}
              >
                <img
                  src={entry.aghs === 'scepter' ? SCEPTER_BADGE : SHARD_BADGE}
                  alt=""
                  style={{ width: 10, height: 10 }}
                />
                {entry.aghs === 'scepter' ? 'Scepter' : 'Shard'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div
              className="uppercase leading-tight mb-2"
              style={{
                color: '#fff',
                fontFamily: 'var(--font-display)',
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '1px',
              }}
            >
              {a?.dname ?? name}
            </div>
            <div
              className="text-[16px] leading-snug"
              style={{ color: '#c8c2b4', fontFamily: 'var(--font-dota)' }}
            >
              {entry.aghs ? entry.aghsDesc : a?.desc}
            </div>
          </div>
        </div>

        {/* Behavior / type row */}
        {(a?.behavior || a?.dmg_type || a?.bkbpierce != null || a?.dispellable != null) && (
          <div
            className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-4"
            style={{ borderBottom: '1px solid #1c1810' }}
          >
            {a?.behavior && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[11px] uppercase tracking-wider shrink-0"
                  style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
                >
                  Ability:
                </span>
                <span
                  className="text-[14px] font-bold"
                  style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                >
                  {joinLv(a.behavior)}
                </span>
              </div>
            )}
            {a?.dmg_type && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[11px] uppercase tracking-wider shrink-0"
                  style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
                >
                  Damage:
                </span>
                <span
                  className="text-[14px] font-bold"
                  style={{ color: '#e8a070', fontFamily: 'var(--font-dota)' }}
                >
                  {String(a.dmg_type)}
                </span>
              </div>
            )}
            {a?.bkbpierce != null && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[11px] uppercase tracking-wider shrink-0"
                  style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
                >
                  Pierces Spell Immunity:
                </span>
                <span
                  className="text-[14px] font-bold"
                  style={{
                    color: String(a.bkbpierce) === 'Yes' ? '#8ec63f' : '#a09a8a',
                    fontFamily: 'var(--font-dota)',
                  }}
                >
                  {String(a.bkbpierce)}
                </span>
              </div>
            )}
            {a?.dispellable != null && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[11px] uppercase tracking-wider shrink-0"
                  style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
                >
                  Dispellable:
                </span>
                <span
                  className="text-[14px] font-bold"
                  style={{ color: '#a09a8a', fontFamily: 'var(--font-dota)' }}
                >
                  {String(a.dispellable)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Attributes: stacked "LABEL: value" lines */}
        {attribs.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #1c1810' }}>
            {attribs.map((x, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static attrib list
              <div key={i} className="flex items-baseline gap-2 py-0.5">
                <span
                  className="text-[12px] uppercase tracking-wide shrink-0"
                  style={{ color: '#6a675e', fontFamily: 'var(--font-dota)' }}
                >
                  {(x.header ?? '').replace(/:$/, '')}:
                </span>
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ color: '#dcd6c8', fontFamily: 'var(--font-dota)' }}
                >
                  {joinLv(x.value)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Cooldown + mana */}
        {(hasCd || hasMc) && (
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: a?.lore && !entry.aghs ? '1px solid #1c1810' : undefined }}
          >
            {hasCd && (
              <div className="flex items-center gap-2">
                <img
                  src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/spellicons/icon_cooldown.png"
                  alt="cooldown"
                  style={{ width: 20, height: 20, opacity: 0.85 }}
                  onError={(ev) => {
                    ev.currentTarget.style.display = 'none'
                  }}
                />
                <span
                  className="text-[16px] font-bold tabular-nums"
                  style={{ color: '#c9a94a', fontFamily: 'var(--font-dota)' }}
                >
                  {joinLv(a?.cd)}
                </span>
              </div>
            )}
            {hasMc && (
              <div className="flex items-center gap-2">
                <img
                  src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/icons/spellicons/icon_manacost.png"
                  alt="mana"
                  style={{ width: 20, height: 20, opacity: 0.85 }}
                  onError={(ev) => {
                    ev.currentTarget.style.display = 'none'
                  }}
                />
                <span
                  className="text-[16px] font-bold tabular-nums"
                  style={{ color: '#5a8fc2', fontFamily: 'var(--font-dota)' }}
                >
                  {joinLv(a?.mc as string | string[])}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lore in its own box */}
        {a?.lore && !entry.aghs && (
          <div className="px-5 py-4">
            <div
              className="text-[13px] italic leading-relaxed px-3 py-2"
              style={{
                color: '#77715f',
                fontFamily: 'var(--font-dota)',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid #1c1810',
              }}
            >
              {a.lore}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
