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
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${name.replace('npc_dota_hero_', '')}.png`
}

export function formatTimeAgo(unixTimestamp: number): string {
  const diff = Date.now() / 1000 - unixTimestamp
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
