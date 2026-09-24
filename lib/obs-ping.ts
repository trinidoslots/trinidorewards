/**
 * The sounds an overlay makes when something happens.
 *
 * Three of them now, not one:
 *
 *   - points    a rising four-note figure, for a payout to chat
 *   - deposit   a falling pair, low
 *   - withdrawal / event   the same pair rising, an octave up
 *
 * The transaction pair is deliberately one idea heard twice: the withdrawal
 * rises E6 → B6 and the deposit is those two notes backwards an octave below,
 * so the two read as a family rather than as two unrelated beeps. The deposit's
 * notes each carry a quiet octave *above* them, because a sine at E5 is almost
 * nothing but its fundamental — the range a stream encoder spends least on and
 * music fills most — and without it the low half vanishes on stream.
 *
 * Everything is synthesised. A file would mean an asset to licence, a request
 * that can 404 mid-stream, and a decode that takes longer than the sound
 * itself; a handful of numbers has none of those problems.
 *
 * Autoplay is the catch. OBS's browser source runs CEF with autoplay allowed,
 * so this works there. A normal browser suspends a new AudioContext until the
 * page has been clicked, so previewing an overlay in Chrome is silent until you
 * click it once. That is handled by resuming on the first interaction and by
 * never throwing when it cannot — an overlay that shows a "click to enable
 * sound" box over the stream is worse than a quiet one.
 */

export type PingKind = "points" | "deposit" | "withdrawal" | "event"

/**
 * Shortest gap between two pings.
 *
 * Not a rate limit — a guard against two announcements landing in the same
 * frame and playing on top of each other, which sounds like a fault rather than
 * like two events.
 */
export const MIN_GAP_MS = 220

const ATTACK_SECONDS = 0.006

/** Keeps the loudest ping well below clipping once notes overlap. */
const HEADROOM = 0.22

/** A sine with its own envelope, optionally doubled an octave above. */
type Tone = {
  frequency: number
  at: number
  duration: number
  /** Fraction of the full level. Defaults to 1. */
  gain?: number
  /** Octave above, same envelope, as a fraction of this tone's level. */
  above?: number
}

/** Rising a fifth. Doubles as the sound for every announcement that is not money. */
const WITHDRAWAL: Tone[] = [
  { frequency: 1318.51, at: 0, duration: 0.373 }, // E6
  { frequency: 1975.53, at: 0.085, duration: 0.46 }, // B6
]

/** The same two notes backwards, an octave below, propped up so they carry. */
const DEPOSIT: Tone[] = [
  { frequency: 987.77, at: 0, duration: 0.373, above: 0.16 }, // B5
  { frequency: 659.26, at: 0.085, duration: 0.46, above: 0.16 }, // E5
]

/**
 * The payout.
 *
 * The pitches and the timing are measured from a reference recording rather
 * than chosen: four notes 65 ms apart climbing D6 · A6 · D7 · G7 — a fifth then
 * two fourths, with the third note exactly double the first. Every one is a
 * plain sine, because measuring the reference's partials at 1.5f, 2f, 3f and 4f
 * returned under 0.03 for all four notes. There is no metallic content in it to
 * reproduce, and the bright click at each onset is only what a fast attack on a
 * sine does by itself.
 *
 * The reference doubles each note an octave below, which is louder and fuller.
 * That version was tried and rejected: the long low octave under the final note
 * beats against itself and reads as a wobble. These are the four notes alone.
 */
const POINTS: Tone[] = [
  { frequency: 1174.66, at: 0, duration: 0.45, gain: 0.5 }, // D6
  { frequency: 1760, at: 0.065, duration: 0.45, gain: 0.5 }, // A6
  { frequency: 2349.32, at: 0.13, duration: 0.45, gain: 0.5 }, // D7
  { frequency: 3135.96, at: 0.195, duration: 0.55, gain: 0.52 }, // G7
]

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
 * One sine with its envelope.
 *
 * Ramped in and out rather than switched: a sine that starts or stops at full
 * amplitude clicks, and the click is louder than the note.
 */
function sine(ctx: AudioContext, frequency: number, start: number, duration: number, peak: number): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = "sine"
  oscillator.frequency.setValueAtTime(frequency, start)

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + ATTACK_SECONDS)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function playTones(ctx: AudioContext, tones: Tone[], level: number): void {
  const start = ctx.currentTime

  for (const tone of tones) {
    // An exponential ramp cannot reach zero, so a silent voice is never built.
    const peak = level * HEADROOM * (tone.gain ?? 1)
    if (peak <= 0) continue

    sine(ctx, tone.frequency, start + tone.at, tone.duration, peak)
    if (tone.above) {
      sine(ctx, tone.frequency * 2, start + tone.at, tone.duration, peak * tone.above)
    }
  }
}

function tonesFor(kind: PingKind): Tone[] {
  if (kind === "points") return POINTS
  if (kind === "deposit") return DEPOSIT
  return WITHDRAWAL
}

/**
 * Plays the sound for an event. Never throws, never blocks — a failed sound
 * must not take an overlay down with it.
 */
export function playPing(volume: number, kind: PingKind = "event"): void {
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
    playTones(ctx, tonesFor(kind), level)
    lastPlayed = now
  } catch {
    // A context that was closed under us, or a browser refusing to schedule.
  }
}

/** Test seam: forgets the gap so two pings in a row can be asserted on. */
export function resetPingGap(): void {
  lastPlayed = 0
}
