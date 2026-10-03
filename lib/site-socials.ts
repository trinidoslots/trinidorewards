/**
 * The social links in the site footer, edited on /admin/settings.
 *
 * Stored as JSON in settings.footer_socials. The settings table only lets the
 * public read three named keys (scripts/072), so the footer reads this through
 * /api/socials (service role) instead of the anon key — no migration needed.
 *
 * Shared by the footer, the admin editor and both API routes, so it holds no
 * React: the icons live in components/social-glyph.tsx.
 */

export const SOCIALS_SETTINGS_KEY = "footer_socials"

export const SOCIAL_PLATFORMS = {
  discord: { label: "Discord", placeholder: "https://discord.gg/…" },
  kick: { label: "Kick", placeholder: "https://kick.com/…" },
  x: { label: "X", placeholder: "https://x.com/…" },
  youtube: { label: "YouTube", placeholder: "https://youtube.com/@…" },
  twitch: { label: "Twitch", placeholder: "https://twitch.tv/…" },
  instagram: { label: "Instagram", placeholder: "https://instagram.com/…" },
  tiktok: { label: "TikTok", placeholder: "https://tiktok.com/@…" },
  telegram: { label: "Telegram", placeholder: "https://t.me/…" },
  website: { label: "Website", placeholder: "https://…" },
} as const

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS

export type SocialLink = {
  platform: SocialPlatform
  url: string
  /** Hidden links stay in the list so they can be switched back on. */
  visible: boolean
}

/** What the footer showed before this was editable. */
export const DEFAULT_SOCIALS: SocialLink[] = [
  { platform: "discord", url: "https://discord.com", visible: true },
  { platform: "kick", url: "https://kick.com/trinidoslots", visible: true },
  { platform: "x", url: "https://x.com", visible: true },
  { platform: "youtube", url: "https://youtube.com", visible: true },
]

export const MAX_SOCIALS = 12

function isPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SOCIAL_PLATFORMS, value)
}

/** https only: the footer opens these in a new tab, and javascript:/http: links have no business there. */
export function cleanSocialUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  if (!text || text.length > 300) return null
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`)
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Reads whatever was stored or sent into a clean list. Unknown platforms and
 * bad URLs are dropped, not repaired. Returns null when the input is not a list
 * at all, so callers can tell "nothing stored" from "stored and empty".
 */
export function parseSocials(raw: unknown): { links: SocialLink[]; dropped: number } | null {
  const list = typeof raw === "string" ? safeJson(raw) : raw
  if (!Array.isArray(list)) return null
  const links: SocialLink[] = []
  let dropped = 0
  for (const entry of list.slice(0, MAX_SOCIALS)) {
    const item = entry as Record<string, unknown>
    const url = cleanSocialUrl(item?.url)
    if (!isPlatform(item?.platform) || !url) {
      dropped++
      continue
    }
    links.push({ platform: item.platform, url, visible: item.visible !== false })
  }
  return { links, dropped: dropped + Math.max(0, list.length - MAX_SOCIALS) }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
