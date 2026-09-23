/**
 * The timers on the top bar: what a row means, and what the buttons do to it.
 *
 * Shared by the widget, which only reads, and the admin route, which writes.
 * Both have to agree on when a timer is running and what "5 more minutes"
 * does, and the old version had that logic in neither place — the page wrote
 * a wall-clock end_time and the widget subtracted it from now. Nothing could
 * pause, and the Start and Stop buttons wrote a column a migration had
 * already dropped, so they did nothing at all and said nothing about it.
 *
 * A timer is in one of three states, and end_time alone cannot express them:
 *
 *   running   paused_remaining_seconds is null, end_time is in the future
 *   paused    paused_remaining_seconds holds what was left; end_time is stale
 *   finished  not paused, and end_time has passed
 */

export type OnZero = "hide" | "hold" | "message"

export type ObsTimerRow = {
  id: string
  message: string
  end_time: string
  duration_seconds: number
  paused_remaining_seconds: number | null
  on_zero: OnZero
  zero_message: string | null
  sort_order: number
  active: boolean
  bold_icon: boolean | null
  bold_message: boolean | null
  bold_time: boolean | null
  data_url: string | null
}

export type TimerState = "running" | "paused" | "finished"

export const MAX_DURATION_SECONDS = 24 * 60 * 60

/** Seconds left, whatever state it is in. Never negative. */
export function remainingSeconds(row: Pick<ObsTimerRow, "end_time" | "paused_remaining_seconds">, now = Date.now()) {
  if (row.paused_remaining_seconds != null) return Math.max(0, Math.floor(row.paused_remaining_seconds))
  const end = new Date(row.end_time).getTime()
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.floor((end - now) / 1000))
}

export function timerState(
  row: Pick<ObsTimerRow, "end_time" | "paused_remaining_seconds">,
  now = Date.now(),
): TimerState {
  if (row.paused_remaining_seconds != null) return "paused"
  return remainingSeconds(row, now) > 0 ? "running" : "finished"
}

/**
 * Whether the strip draws this timer at all.
 *
 * Inactive is always hidden. A finished one depends on what it was told to do
 * at zero, which is the whole point of on_zero: the old widget filtered on
 * `remaining > 0`, so every timer vanished the instant it mattered most.
 */
export function isTimerVisible(row: ObsTimerRow, now = Date.now()) {
  if (!row.active) return false
  if (timerState(row, now) !== "finished") return true
  return row.on_zero !== "hide"
}

/** What the strip prints for the time: a clock, or the message at zero. */
export function timerReadout(row: ObsTimerRow, now = Date.now()) {
  const left = remainingSeconds(row, now)
  if (left > 0 || row.on_zero === "hold") return formatDuration(left)
  return row.zero_message?.trim() || "NOW"
}

/** h:mm:ss past an hour, m:ss below it. */
export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Reads a duration the way a person would type one.
 *
 * "20" is twenty minutes, because that is what someone setting a stream timer
 * means by a bare number. Everything else has to say: 90s, 1h30m, 5:00,
 * 1:30:00. Returns null when it cannot tell, rather than a confident zero.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase()
  if (!text) return null

  // 5:00 or 1:30:00
  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(text)) {
    const parts = text.split(":").map(Number)
    const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]]
    if (m > 59 || s > 59) return null
    return clampDuration(h * 3600 + m * 60 + s)
  }

  // 90s, 20m, 2h, 1h30m
  const units = [...text.matchAll(/(\d+(?:\.\d+)?)\s*([hms])/g)]
  if (units.length > 0) {
    // Reject trailing junk: "20m please" is a typo, not twenty minutes.
    if (text.replace(/(\d+(?:\.\d+)?)\s*([hms])/g, "").trim() !== "") return null
    const factor = { h: 3600, m: 60, s: 1 }
    return clampDuration(units.reduce((total, [, value, unit]) => total + Number(value) * factor[unit as "h" | "m" | "s"], 0))
  }

  // A bare number means minutes.
  if (/^\d+(\.\d+)?$/.test(text)) return clampDuration(Number(text) * 60)

  return null
}

function clampDuration(seconds: number) {
  const whole = Math.round(seconds)
  if (!Number.isFinite(whole) || whole <= 0) return null
  return Math.min(whole, MAX_DURATION_SECONDS)
}

export type TimerAction =
  | { action: "pause" }
  | { action: "resume" }
  | { action: "restart" }
  | { action: "extend"; seconds: number }

/**
 * The column changes one of the control buttons makes.
 *
 * Returned rather than applied, so the route can write it and a test can read
 * it. Every action is expressed against `now`, which is why resuming is a
 * fresh end_time and not an adjustment to the old one — the old one is from
 * before the pause and means nothing.
 */
export function applyTimerAction(
  row: Pick<ObsTimerRow, "end_time" | "paused_remaining_seconds" | "duration_seconds">,
  action: TimerAction,
  now = Date.now(),
): Record<string, unknown> {
  const endAt = (seconds: number) => new Date(now + seconds * 1000).toISOString()

  switch (action.action) {
    case "pause":
      // Pausing a finished timer would pin it at zero and call that paused.
      return { paused_remaining_seconds: Math.max(1, remainingSeconds(row, now)) }

    case "resume":
      return { paused_remaining_seconds: null, end_time: endAt(remainingSeconds(row, now)) }

    case "restart":
      return { paused_remaining_seconds: null, end_time: endAt(row.duration_seconds) }

    case "extend": {
      const left = remainingSeconds(row, now) + action.seconds
      const bounded = Math.max(0, Math.min(left, MAX_DURATION_SECONDS))
      // Extending a paused timer leaves it paused — it just has more left.
      return row.paused_remaining_seconds != null
        ? { paused_remaining_seconds: bounded }
        : { end_time: endAt(bounded) }
    }
  }
}
