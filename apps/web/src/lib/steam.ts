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

export type SteamProfile = { personaname: string; avatarfull: string; isPublic: boolean }

// OpenDota only has a player's persona name/avatar once something has
// triggered it to resolve and cache that account's Steam profile, which can
// lag well behind a page load (sometimes indefinitely, for an account that's
// never been individually visited before). Steam's own basic profile
// identity (name, avatar) is public regardless of the account's privacy
// setting, only game details/friends are gated by privacy, so this can
// resolve a name/picture immediately via the same playerdb.co proxy already
// used for vanity resolution, and report communityvisibilitystate so callers
// can show a "Private" indicator instead of pretending the profile is public.
export async function fetchSteamProfile(accountId: number): Promise<SteamProfile | null> {
  try {
    const steamId64 = (STEAM64_BASE + BigInt(accountId)).toString()
    const res = await fetch(`https://playerdb.co/api/player/steam/${steamId64}`)
    if (!res.ok) return null
    const data = await res.json()
    const meta = data?.data?.player?.meta
    if (!meta?.personaname) return null
    return {
      personaname: meta.personaname,
      avatarfull: meta.avatarfull ?? meta.avatar,
      isPublic: meta.communityvisibilitystate === 3,
    }
  } catch {
    return null
  }
}
