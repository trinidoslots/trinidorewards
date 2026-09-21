/**
 * The sound an overlay makes when something happens.
 *
 * Synthesised rather than played from a file. A two-tone blip is a handful of
 * numbers, and a file would mean an asset to licence, a request that can 404
 * mid-stream, and a decode that takes longer than the sound itself.
 *
 * Autoplay is the catch. OBS's browser source runs CEF with autoplay allowed,
 * so this works there. A normal browser suspends a new AudioContext until the
 * page has been clicked, so previewing an overlay in Chrome is silent until you
 * click it once. That is handled by resuming on the first interaction and by
 * never throwing when it cannot — an overlay that shows a "click to enable
 * sound" box over the stream is worse than a quiet one.
 */

/** Two notes a fifth apart: recognisable at low volume, short enough to talk over. */
const NOTES: { frequency: number; at: number; duration: number }[] = [
  { frequency: 880, at: 0, duration: 0.26 },
  { frequency: 1318.51, at: 0.085, duration: 0.32 },
]

/**
 * Shortest gap between two pings.
 *
 * Not a rate limit — a guard against two announcements landing in the same
 * frame and playing on top of each other, which sounds like a fault rather than
 * like two events.
 */
export const MIN_GAP_MS = 220

const ATTACK_SECONDS = 0.006

/** Keeps the loudest ping well below clipping once both notes overlap. */
const HEADROOM = 0.22

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/** `?volume=0.4`. Anything unreadable means the default rather than silence. */
export function readVolume(raw: string | null | undefined, fallback = 0.5): number {
  if (raw === null || raw === undefined || raw.trim() === "") return clampVolume(fallback)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return clampVolume(fallback)
  // Accepts 0–1 and 0–100, because both are the obvious thing to type.
  return clampVolume(parsed > 1 ? parsed / 100 : parsed)
}

/**
 * `?ping=1`. Off unless asked for: an overlay that is already on stream should
 * not start making noise because it was redeployed.
 */
export function pingEnabled(raw: string | null | undefined): boolean {
  if (!raw) return false
  const value = raw.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes" || value === "on"
}

type Ctor = typeof AudioContext
let context: AudioContext | null = null
let lastPlayed = 0

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (context) return context

  // Safari and older CEF builds only have the prefixed one.
  const Ctor: Ctor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!Ctor) return null

  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

/**
 * Lets a suspended context start on the first click or key.
 *
 * Only matters outside OBS. Registered once and removed as soon as it fires.
 */
export function unlockOnInteraction(): () => void {
  if (typeof window === "undefined") return () => {}

  const unlock = () => {
    const ctx = audioContext()
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {})
    remove()
  }
  const remove = () => {
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
  }

  window.addEventListener("pointerdown", unlock, { once: true })
  window.addEventListener("keydown", unlock, { once: true })
  return remove
}

/**
 * Plays the ping. Never throws, never blocks — a failed sound must not take an
 * overlay down with it.
 */
export function playPing(volume: number): void {
  const level = clampVolume(volume)
  if (level === 0) return

  const now = Date.now()
  if (now - lastPlayed < MIN_GAP_MS) return

  const ctx = audioContext()
  if (!ctx) return

  // In OBS this is already running. Elsewhere it stays suspended until the page
  // has been interacted with, and the scheduled notes simply never sound.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {})

  try {
    const start = ctx.currentTime

    for (const note of NOTES) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(note.frequency, start + note.at)

      // Ramped in and out rather than switched: a sine that starts or stops at
      // full amplitude clicks, and the click is louder than the note.
      const peak = level * HEADROOM
      gain.gain.setValueAtTime(0.0001, start + note.at)
      gain.gain.exponentialRampToValueAtTime(peak, start + note.at + ATTACK_SECONDS)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.duration)

      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start + note.at)
      oscillator.stop(start + note.at + note.duration + 0.02)
    }

    lastPlayed = now
  } catch {
    // A context that was closed under us, or a browser refusing to schedule.
  }
}

/** Test seam: forgets the gap so two pings in a row can be asserted on. */
export function resetPingGap(): void {
  lastPlayed = 0
}
