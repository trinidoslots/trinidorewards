/**
 * The sounds an overlay makes when something happens.
 *
 * Three of them now, not one:
 *
 *   - points    the coin sample, for a payout to chat
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

/** Keeps the loudest synthesised ping well below clipping once notes overlap. */
const HEADROOM = 0.22

/** A sine, optionally doubled an octave away from itself. */
type Tone = {
  frequency: number
  at: number
  duration: number
  /** Octave above, same envelope, as a fraction of this tone's level. */
  above?: number
  /** Octave below, with its own decay — this is what gives a coin its body. */
  below?: { gain: number; duration: number }
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
 * The coin, as a file.
 *
 * This module used to synthesise everything, on the reasoning that a file means
 * an asset to licence, a request that can 404 mid-stream, and a decode that
 * takes longer than the sound itself. All three still apply and all three are
 * answered: the asset is the streamer's own, the buffer is fetched and decoded
 * once at load rather than per play, and a failure falls through to
 * COIN_FIGURE below rather than to silence.
 */
const COIN_SRC = "/obs-coin.mp3"

/**
 * The file's first 557 ms are silent. Played from zero, every payout would
 * arrive half a second after the thing it is announcing; this starts a hair
 * before the first sample so the attack is not clipped either.
 */
const COIN_OFFSET = 0.545

/**
 * Measured peak of the sample, used to normalise it against the ping below.
 *
 * Taken across both channels, not from a mono mix: the mix averages them and
 * reads 0.728, which would set the gain about 10% hot and is the wrong number
 * for a clipping ceiling anyway.
 */
const COIN_FILE_PEAK = 0.8003

/** What the coin peaks at, at volume 1 — a little under twice the ping's, since it is the payout. */
const COIN_PEAK = 0.4

/**
 * The coin, resynthesised, for when the file cannot be had.
 *
 * Measured from the sample rather than invented: four notes 65 ms apart,
 * climbing D6 · A6 · D7 · G7 — a fifth then two fourths, with the third note
 * exactly double the first. Every note is a pure sine doubled an octave below
 * at 0.56, and nothing above the fundamental: partials at 1.5f, 2f, 3f and 4f
 * all measure under 0.03 in the original. The lower octave rings far longer
 * than the note that is struck, and that split is what holds the sound up.
 */
const COIN_FIGURE: Tone[] = [
  { frequency: 1174.66, at: 0, duration: 0.45, below: { gain: 0.56, duration: 0.95 } },
  { frequency: 1760, at: 0.065, duration: 0.45, below: { gain: 0.56, duration: 0.95 } },
  { frequency: 2349.32, at: 0.13, duration: 0.45, below: { gain: 0.56, duration: 0.95 } },
  { frequency: 3135.96, at: 0.195, duration: 0.55, below: { gain: 0.56, duration: 1.9 } },
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

let coinBuffer: AudioBuffer | null = null
let coinPending: Promise<void> | null = null

/**
 * Fetches and decodes the coin once.
 *
 * Call it when an overlay mounts. Left to the first payout, that payout is the
 * one that pays for the round trip and the decode, which is exactly the moment
 * that must not be late — and if the file is missing, the fallback would be
 * discovered on stream rather than on load.
 */
export function preloadPing(): void {
  const ctx = audioContext()
  if (!ctx || coinBuffer || coinPending) return

  coinPending = fetch(COIN_SRC)
    .then((response) => {
      if (!response.ok) throw new Error(`obs-coin.mp3: ${response.status}`)
      return response.arrayBuffer()
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((decoded) => {
      coinBuffer = decoded
    })
    .catch((problem) => {
      // Not fatal, and deliberately not retried in a loop: COIN_FIGURE covers
      // it, and a broken path should not turn into a request per payout.
      console.error("[obs] Could not load the coin sound, falling back to the synth:", problem)
    })
    .finally(() => {
      coinPending = null
    })
}

/** One sine with its envelope. Ramped rather than switched: a sine that starts or stops at full amplitude clicks, and the click is louder than the note. */
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
  const peak = level * HEADROOM

  for (const tone of tones) {
    sine(ctx, tone.frequency, start + tone.at, tone.duration, peak)
    if (tone.above) {
      sine(ctx, tone.frequency * 2, start + tone.at, tone.duration, peak * tone.above)
    }
    if (tone.below) {
      sine(ctx, tone.frequency / 2, start + tone.at, tone.below.duration, peak * tone.below.gain)
    }
  }
}

function playCoin(ctx: AudioContext, level: number): void {
  if (!coinBuffer) {
    // Kick off the load for next time, and cover this one with the synth.
    preloadPing()
    playTones(ctx, COIN_FIGURE, level)
    return
  }

  const source = ctx.createBufferSource()
  const gain = ctx.createGain()

  source.buffer = coinBuffer
  gain.gain.value = (level * COIN_PEAK) / COIN_FILE_PEAK

  source.connect(gain)
  gain.connect(ctx.destination)
  // The second argument is an offset into the buffer, not a delay.
  source.start(ctx.currentTime, COIN_OFFSET)
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
    if (kind === "points") {
      playCoin(ctx, level)
    } else {
      playTones(ctx, kind === "deposit" ? DEPOSIT : WITHDRAWAL, level)
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
