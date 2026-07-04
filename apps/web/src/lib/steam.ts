export const STEAM64_BASE = BigInt('76561197960265728')

/* Resolve a Steam vanity URL slug (steamcommunity.com/id/<vanity>) to a Dota
   account_id via playerdb.co (public, no API key required). Returns null if
   the vanity name doesn't exist or isn't a Steam profile. */
export async function resolveVanitySteamId(vanity: string): Promise<string | null> {
  try {
    const res = await fetch(`https://playerdb.co/api/player/steam/${encodeURIComponent(vanity)}`)
    if (!res.ok) return null
    const data = await res.json()
    const steam64 = data?.data?.player?.id
    if (!steam64) return null
    return String(BigInt(steam64) - STEAM64_BASE)
  } catch {
    return null
  }
}
