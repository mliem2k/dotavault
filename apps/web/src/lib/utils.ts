import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { HeroStat } from 'types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds) % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function heroIconUrl(name: string): string {
  return `/heroes/${name.replace('npc_dota_hero_', '')}.webp`
}

export function heroIconFromPath(iconPath: string): string {
  const filename = iconPath.split('/').pop() ?? ''
  return `/heroes/${filename.replace('.png', '.webp')}`
}

export const ITEM_CDN_FALLBACK = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items'

export function itemIconUrl(name: string): string {
  return `/items/${name}.webp`
}

/* ---- Self-hosted Dota assets (local-first, CDN fallback on error) ---- */

const IMG_CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images'
const IMG_CDN2 = 'https://cdn.steamstatic.com/apps/dota2/images'

function short(name: string): string {
  return name.replace('npc_dota_hero_', '')
}

// URL slug for hero pages, matching dota2.com: the display name lowercased
// with everything but letters/digits/hyphens stripped ("Anti-Mage" →
// "anti-mage", "Zeus" → "zeus", "Nature's Prophet" → "naturesprophet").
export function heroSlug(localizedName: string): string {
  return localizedName.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export const heroLandscapeUrl = (name: string) => `/landscape/${short(name)}.webp`
export const heroLandscapeCdn = (name: string) => `${IMG_CDN}/dota_react/heroes/${short(name)}.png`
export const heroSbUrl = (name: string) => `/portraits/${short(name)}_sb.webp`
export const heroSbCdn = (name: string) => `${IMG_CDN}/heroes/${short(name)}_sb.png`
export const heroVertUrl = (name: string) => `/portraits/${short(name)}_vert.webp`
export const heroVertCdn = (name: string) => `${IMG_CDN}/heroes/${short(name)}_vert.jpg`
export const abilityIconUrl = (name: string) => `/abilities/${name}.webp`
export const abilityIconCdn = (name: string, imgPath?: string) =>
  imgPath ? `https://cdn.cloudflare.steamstatic.com${imgPath}` : `${IMG_CDN}/dota_react/abilities/${name}.png`
export const dotaIconUrl = (name: string) => `/dota_icons/${name}.webp`

export const AGHS_SCEPTER_CDN = `${IMG_CDN2}/dota_react/heroes/stats/aghs_scepter.png`
export const AGHS_SHARD_CDN = `${IMG_CDN2}/dota_react/heroes/stats/aghs_shard.png`
export const INNATE_ICON_CDN = `${IMG_CDN2}/dota_react/icons/innate_icon.png`
export const TALENTS_ICON_CDN = `${IMG_CDN2}/dota_react/icons/talents.svg`

// Reusable <img onError> that swaps to a CDN url exactly once.
export function cdnFallback(cdnUrl: string) {
  return (e: { currentTarget: HTMLImageElement }) => {
    const el = e.currentTarget
    if (el.dataset.fb !== '1') {
      el.dataset.fb = '1'
      el.src = cdnUrl
    }
  }
}

export function formatTimeAgo(unixTimestamp: number): string {
  const diff = Date.now() / 1000 - unixTimestamp
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function formatDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

export function winRate(wins: number, total: number): string {
  if (total === 0) return '0%'
  return `${((wins / total) * 100).toFixed(1)}%`
}

// The double cast is required because template literal keys like `1_${field}` cannot
// be statically resolved by TypeScript against the HeroStat type's numeric string keys.
export function heroBracketTotal(h: HeroStat, field: 'pick' | 'win'): number {
  return (
    ((h as unknown as Record<string, number>)[`1_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`2_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`3_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`4_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`5_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`6_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`7_${field}`] ?? 0) +
    ((h as unknown as Record<string, number>)[`8_${field}`] ?? 0)
  )
}
