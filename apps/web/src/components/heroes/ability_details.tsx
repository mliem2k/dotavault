import { useLayoutEffect, useRef, useState } from 'react'
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
  innateNames,
  hasTalents,
  aghsNewSkillNames,
  selectedIdx,
  onSelectIdx,
}: {
  heroShort: string
  abilityList: string[]
  abilities: Record<string, AbilityConst>
  aghs?: AghsDesc
  innateNames?: string[]
  hasTalents?: boolean
  aghsNewSkillNames?: string[]
  selectedIdx?: number
  onSelectIdx?: (i: number) => void
}) {
  const entries: Entry[] = abilityList.map((base) => ({ base }))
  if (aghs?.has_scepter) {
    const base =
      abilityList.find((n) => abilities[n]?.dname === aghs.scepter_skill_name) ??
      (aghsNewSkillNames ?? []).find((n) => abilities[n]?.dname === aghs.scepter_skill_name) ??
      abilityList[0]
    if (base) entries.push({ base, aghs: 'scepter', aghsDesc: aghs.scepter_desc })
  }
  if (aghs?.has_shard) {
    const base =
      abilityList.find((n) => abilities[n]?.dname === aghs.shard_skill_name) ??
      (aghsNewSkillNames ?? []).find((n) => abilities[n]?.dname === aghs.shard_skill_name) ??
      abilityList[0]
    if (base) entries.push({ base, aghs: 'shard', aghsDesc: aghs.shard_desc })
  }

  const leftColRef = useRef<HTMLDivElement>(null)
  const [rightMaxH, setRightMaxH] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const el = leftColRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setRightMaxH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [internalSel, setInternalSel] = useState(0)
  const sel = selectedIdx ?? internalSel
  const setSel = (i: number) => {
    setInternalSel(i)
    onSelectIdx?.(i)
  }
  const entry = entries[sel] ?? entries[0]
  if (!entry) return null
  const name = entry.base
  const a: AbilityConst | undefined = abilities[name]
  const videoName =
    entry.aghs === 'scepter' && !abilityList.includes(name)
      ? `${heroShort}_aghanims_scepter`
      : entry.aghs === 'shard' && !abilityList.includes(name)
      ? `${heroShort}_aghanims_shard`
      : name
  const videoBase = `${VID}/${heroShort}/${videoName}`
  const attribs = (a?.attrib ?? []).filter((x) => {
    if (!x.header || x.value === '' || x.value == null) return false
    if (x.generated) return false
    const v = joinLv(x.value)
    return v !== '' && v !== '0' && !v.split(' / ').every((s) => s === '0')
  })
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
    // Two-column: video+selector on left, dark details panel on right — centered, not edge-to-edge
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left: video with selector row below */}
      <div ref={leftColRef} className="shrink-0 flex flex-col" style={{ width: '100%', maxWidth: 640 }}>
        <div
          className="relative overflow-hidden bg-background"
          style={{ aspectRatio: '16 / 9', boxShadow: '0 0 32px 8px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)' }}
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

        {/* Ability selector: horizontal row below video, scrollable on mobile */}
        <div className="flex items-center justify-center gap-1 px-2 py-2 overflow-x-auto relative z-10" style={{ marginTop: -32 }}>
          {entries.map((e, i) => (
            <button
              key={`${e.base}-${e.aghs ?? 'base'}`}
              type="button"
              onClick={() => setSel(i)}
              className="relative shrink-0 overflow-hidden transition-[filter]"
              style={{
                width: 64,
                height: 64,
                border: i === sel ? '2px solid rgba(255,255,255,0.7)' : '2px solid rgba(255,255,255,0.1)',
                filter: i === sel ? 'none' : 'grayscale(1) brightness(0.7)',
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
                    width: 40,
                    height: 40,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.9))',
                  }}
                  onError={cdnFallback(e.aghs === 'scepter' ? AGHS_SCEPTER_CDN : AGHS_SHARD_CDN)}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: details panel */}
      <div className="flex-1 min-w-0 flex flex-col" style={{ background: 'rgb(0,0,0)', minHeight: 0, padding: '20px 20px 15px', maxHeight: rightMaxH ?? undefined, overflowY: rightMaxH ? 'auto' : undefined }}>
        {/* Name + icon + description */}
        <div className="flex items-start gap-4 pb-4 border-b border-border">
          <div className="shrink-0 border border-border">
            <AbilityIcon entry={entry} size={84} />
            {entry.aghs && (
              <div
                className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest px-1 py-0.5 ${entry.aghs === 'scepter' ? 'text-accent' : ''}`}
                style={{
                  background: entry.aghs === 'scepter' ? '#12233a' : '#1a2338',
                  color: entry.aghs === 'scepter' ? undefined : '#8fb0e0',
                }}
              >
                <img
                  src={entry.aghs === 'scepter' ? SCEPTER_BADGE : SHARD_BADGE}
                  alt=""
                  style={{ width: 20, height: 20 }}
                />
                {entry.aghs === 'scepter' ? 'Scepter' : 'Shard'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div
              className="uppercase leading-tight mb-2 text-white font-display"
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '1px',
              }}
            >
              {a?.dname ?? name}
            </div>
            <div
              className="text-[15px] leading-snug text-foreground font-dota"
            >
              {entry.aghs ? entry.aghsDesc : a?.desc}
            </div>
          </div>
        </div>

        {/* Behavior / type row: left col = Ability + Damage, right col = Pierces + Dispellable stacked */}
        {(a?.behavior || a?.dmg_type || a?.bkbpierce != null || a?.dispellable != null) && (
          <div
            className="flex gap-x-4 py-4 border-b border-border"
          >
            {/* Left: targeting type and damage type */}
            <div className="flex-1 flex flex-col gap-y-1">
              {a?.behavior && (
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-[13px] uppercase font-bold tracking-wider shrink-0 font-dota"
                    style={{ color: '#7a8a99' }}
                  >
                    Ability:
                  </span>
                  <span
                    className="text-[14px] font-bold text-white font-dota"
                  >
                    {(Array.isArray(a.behavior)
                      ? a.behavior.filter((b) =>
                          ['No Target','Unit Target','Point Target','Toggle','Passive','Aura','Channeled','Instant Attack'].includes(b)
                        ).join(' / ') || a.behavior[0]
                      : String(a.behavior))}
                  </span>
                </div>
              )}
              {a?.dmg_type && (
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-[13px] uppercase font-bold tracking-wider shrink-0 font-dota"
                    style={{ color: '#7a8a99' }}
                  >
                    Damage:
                  </span>
                  <span
                    className="text-[14px] font-bold text-white font-dota"
                  >
                    {String(a.dmg_type)}
                  </span>
                </div>
              )}
            </div>
            {/* Right: spell immunity pierce and dispellable stacked */}
            {(a?.bkbpierce != null || a?.dispellable != null) && (
              <div className="flex flex-col gap-y-1">
                {a?.bkbpierce != null && (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[13px] uppercase font-bold tracking-wider shrink-0 font-dota"
                      style={{ color: '#7a8a99' }}
                    >
                      Pierces Spell Immunity:
                    </span>
                    <span
                      className={`text-[14px] font-bold font-dota ${String(a.bkbpierce) === 'Yes' ? 'text-radiant' : 'text-white'}`}
                    >
                      {String(a.bkbpierce)}
                    </span>
                  </div>
                )}
                {a?.dispellable != null && (
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-[13px] uppercase font-bold tracking-wider shrink-0 font-dota"
                      style={{ color: '#7a8a99' }}
                    >
                      Dispellable:
                    </span>
                    <span
                      className="text-[14px] font-bold text-white font-dota"
                    >
                      {String(a.dispellable)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Attributes: stacked "LABEL: value" lines */}
        {attribs.length > 0 && (
          <div className="py-4 border-b border-border">
            {attribs.map((x, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static attrib list
              <div key={i} className="flex items-baseline gap-2 py-0.5">
                <span
                  className="text-[12px] uppercase font-bold tracking-wider shrink-0 font-dota"
                  style={{ color: '#7a8a99' }}
                >
                  {(x.header ?? '').replace(/:$/, '')}:
                </span>
                <span
                  className="text-[15px] font-bold tabular-nums text-white font-dota"
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
            className={`flex items-center justify-between py-4 ${a?.lore && !entry.aghs ? 'border-b border-border' : ''}`}
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
                  className="text-[16px] font-bold tabular-nums font-dota"
                  style={{ color: '#8b9bc8' }}
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
                  className="text-[16px] font-bold tabular-nums font-dota"
                  style={{ color: '#00a4db' }}
                >
                  {joinLv(a?.mc as string | string[])}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Lore in its own box */}
        {a?.lore && !entry.aghs && (
          <div className="py-4">
            <div
              className="text-[13px] italic leading-relaxed px-3 py-2 font-dota border border-border"
              style={{
                color: '#77715f',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {a.lore}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}
