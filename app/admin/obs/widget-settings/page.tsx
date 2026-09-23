"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"
import { FIELD_CLASS, SelectMenu } from "@/components/ui/select-menu"
import {
  formatDuration,
  isTimerVisible,
  parseDuration,
  remainingSeconds,
  timerReadout,
  timerState,
  type ObsTimerRow,
  type OnZero,
} from "@/lib/obs-timers"

/**
 * What the top bar's timers and info lines say.
 *
 * Every write goes through /api/admin/obs-timers and /api/admin/obs-info.
 * Nothing here talks to Supabase directly any more: the page used to write
 * with the public anon key, which ships in the browser bundle of every page
 * on the site, to tables that accepted writes from anyone holding it.
 *
 * Timers are set by LENGTH, not by a wall-clock end time. Typing "20" means
 * twenty minutes from the moment you press Add, which is what someone setting
 * a stream timer means; before, you had to work out what time it would be and
 * type that into a datetime field.
 */

type Info = {
  id: string
  message: string
  active: boolean
  sort_order: number
  word_styles: { index: number; bold?: boolean; italic?: boolean; underline?: boolean }[] | null
  data_url: string | null
}

const ON_ZERO_OPTIONS = [
  { value: "hide", label: "Disappear" },
  { value: "hold", label: "Hold at 0:00" },
  { value: "message", label: "Show a message" },
]

/** The lengths worth one press. Anything else gets typed. */
const QUICK_MINUTES = [5, 10, 15, 30]

const STATE_ACCENT = { running: "green", paused: "amber", finished: "slate" } as const

/* ------------------------------------------------------------- plumbing */

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error ?? "That did not work.")
  return payload as T
}

/** Reads a file the admin picked into a data URL for the widget to draw. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Could not read that file."))
    reader.readAsDataURL(file)
  })
}

/* ---------------------------------------------------------------- pieces */

/**
 * A destructive button that asks first, in place.
 *
 * Not window.confirm: this page had nineteen browser dialogs in it, and they
 * stop the page dead, look nothing like the rest of the panel, and say
 * "localhost:3000 says".
 */
function DeleteButton({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const timeout = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timeout)
  }, [armed])

  if (!armed) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setArmed(true)}
        className="flex h-7 w-7 items-center justify-center rounded border border-white/[0.10] text-white/35 transition hover:border-white/25 hover:text-white"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={onConfirm}
        className="rounded px-2 py-1 text-[11px] font-medium transition"
        style={{ backgroundColor: `${ACCENTS.red}22`, color: ACCENTS.red }}
      >
        Remove
      </button>
      <button
        type="button"
        aria-label="Keep it"
        onClick={() => setArmed(false)}
        className="flex h-7 w-7 items-center justify-center rounded text-white/35 transition hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

function IconButton({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded border border-white/[0.10] text-white/45 transition hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  )
}

/** Picks an image and hands back a data URL, with a preview of what is set. */
function IconPicker({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const input = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (file) onChange(await readAsDataUrl(file))
          event.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/55 transition hover:border-white/20 hover:text-white"
      >
        <Upload className="h-3.5 w-3.5" />
        {value ? "Replace icon" : "Icon"}
      </button>
      {value && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL */}
          <img
            src={value}
            alt=""
            className="h-5 w-5 object-contain"
            style={{ filter: "brightness(0) saturate(100%) invert(1)" }}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-[11px] text-white/35 transition hover:text-white"
          >
            Clear
          </button>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export default function WidgetSettingsPage() {
  const [timers, setTimers] = useState<ObsTimerRow[]>([])
  const [infos, setInfos] = useState<Info[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  // A new timer.
  const [label, setLabel] = useState("")
  const [length, setLength] = useState("15")
  const [onZero, setOnZero] = useState<OnZero>("hide")
  const [zeroMessage, setZeroMessage] = useState("")
  const [timerIcon, setTimerIcon] = useState("")

  // A new info line.
  const [infoText, setInfoText] = useState("")
  const [infoIcon, setInfoIcon] = useState("")

  /** Ticks once a second so the countdowns move. */
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const announce = (message: string) => {
    setSaved(message)
    setError(null)
    setTimeout(() => setSaved((current) => (current === message ? null : current)), 2500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [timerData, infoData] = await Promise.all([
        call<{ rows: ObsTimerRow[] }>("/api/admin/obs-timers"),
        call<{ rows: Info[] }>("/api/admin/obs-info"),
      ])
      setTimers(timerData.rows)
      setInfos(infoData.rows)
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Runs a write, shows what went wrong, and never leaves the page busy. */
  const run = async (work: () => Promise<void>, done?: string) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      if (done) announce(done)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  const seconds = parseDuration(length)

  const addTimer = () =>
    run(async () => {
      if (!label.trim()) throw new Error("Give the timer a label.")
      if (!seconds) throw new Error(`"${length}" is not a length. Try 20, 90s, 1h30m or 5:00.`)
      const { row } = await call<{ row: ObsTimerRow }>("/api/admin/obs-timers", {
        method: "POST",
        body: JSON.stringify({
          message: label,
          duration_seconds: seconds,
          on_zero: onZero,
          zero_message: zeroMessage,
          data_url: timerIcon || null,
        }),
      })
      setTimers((current) => [...current, row])
      setLabel("")
      setZeroMessage("")
      setTimerIcon("")
    }, "Timer started.")

  const patchTimer = (id: string, body: Record<string, unknown>, done?: string) =>
    run(async () => {
      const { row } = await call<{ row: ObsTimerRow }>("/api/admin/obs-timers", {
        method: "PATCH",
        body: JSON.stringify({ id, ...body }),
      })
      setTimers((current) => current.map((timer) => (timer.id === id ? row : timer)))
    }, done)

  const removeTimer = (id: string) =>
    run(async () => {
      await call(`/api/admin/obs-timers?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      setTimers((current) => current.filter((timer) => timer.id !== id))
    }, "Timer removed.")

  /**
   * Swaps two rows' sort_order.
   *
   * Two writes rather than one, because the pair has to end up with each
   * other's number and there is no single update that says that.
   */
  const moveTimer = (index: number, delta: number) => {
    const a = timers[index]
    const b = timers[index + delta]
    if (!a || !b) return
    return run(async () => {
      await Promise.all([
        call("/api/admin/obs-timers", { method: "PATCH", body: JSON.stringify({ id: a.id, sort_order: b.sort_order }) }),
        call("/api/admin/obs-timers", { method: "PATCH", body: JSON.stringify({ id: b.id, sort_order: a.sort_order }) }),
      ])
      setTimers((current) => {
        const next = [...current]
        next[index] = { ...b, sort_order: a.sort_order }
        next[index + delta] = { ...a, sort_order: b.sort_order }
        return next
      })
    })
  }

  const addInfo = () =>
    run(async () => {
      if (!infoText.trim()) throw new Error("Type the line first.")
      const { row } = await call<{ row: Info }>("/api/admin/obs-info", {
        method: "POST",
        body: JSON.stringify({ message: infoText, data_url: infoIcon || null }),
      })
      setInfos((current) => [...current, row])
      setInfoText("")
      setInfoIcon("")
    }, "Info line added.")

  const patchInfo = (id: string, body: Record<string, unknown>, done?: string) =>
    run(async () => {
      const { row } = await call<{ row: Info }>("/api/admin/obs-info", {
        method: "PATCH",
        body: JSON.stringify({ id, ...body }),
      })
      setInfos((current) => current.map((info) => (info.id === id ? row : info)))
    }, done)

  const removeInfo = (id: string) =>
    run(async () => {
      await call(`/api/admin/obs-info?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      setInfos((current) => current.filter((info) => info.id !== id))
    }, "Info line removed.")

  const onStrip = timers.filter((timer) => isTimerVisible(timer)).length

  return (
    <div className="space-y-4 pb-10">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Widget settings</h1>
        <MonoLabel className="text-white/25">{onStrip} on the strip</MonoLabel>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 py-1.5 text-[12px] text-white/60 transition hover:border-white/20 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Reload
        </button>
      </header>

      {/* One banner for the whole page, where the alerts used to be. */}
      {(error || saved) && (
        <div
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-[13px]"
          style={
            error
              ? { borderColor: `${ACCENTS.red}55`, color: ACCENTS.red, backgroundColor: `${ACCENTS.red}11` }
              : { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green, backgroundColor: `${ACCENTS.green}11` }
          }
        >
          {error ? <X className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0" />}
          {error ?? saved}
        </div>
      )}

      {/* ------------------------------------------------------- timers */}

      <Panel accent="blue">
        <PanelHeader title="New timer" accent="blue" />
        <div className="space-y-3 p-3.5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <label htmlFor="timer-label" className="mb-1.5 block">
                <MonoLabel className="text-white/40">Label</MonoLabel>
              </label>
              <input
                id="timer-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Giveaway closes in"
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label htmlFor="timer-length" className="mb-1.5 block">
                <MonoLabel className="text-white/40">Length</MonoLabel>
              </label>
              <input
                id="timer-length"
                value={length}
                onChange={(event) => setLength(event.target.value)}
                placeholder="20"
                className={FIELD_CLASS}
                aria-describedby="timer-length-hint"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {QUICK_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setLength(String(minutes))}
                className="rounded-md border border-white/[0.10] px-2.5 py-1 text-[12px] text-white/55 transition hover:border-white/25 hover:text-white"
              >
                {minutes} min
              </button>
            ))}
            <span id="timer-length-hint" className="ml-1">
              <MonoLabel className="text-white/30">
                {seconds ? `= ${formatDuration(seconds)}` : "20 · 90s · 1h30m · 5:00"}
              </MonoLabel>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div>
              <label htmlFor="timer-zero" className="mb-1.5 block">
                <MonoLabel className="text-white/40">At zero</MonoLabel>
              </label>
              <SelectMenu
                id="timer-zero"
                value={onZero}
                onChange={(value) => setOnZero(value as OnZero)}
                options={ON_ZERO_OPTIONS}
              />
            </div>
            {onZero === "message" && (
              <div>
                <label htmlFor="timer-zero-message" className="mb-1.5 block">
                  <MonoLabel className="text-white/40">Message</MonoLabel>
                </label>
                <input
                  id="timer-zero-message"
                  value={zeroMessage}
                  onChange={(event) => setZeroMessage(event.target.value)}
                  placeholder="NOW"
                  className={FIELD_CLASS}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <IconPicker value={timerIcon} onChange={setTimerIcon} />
            <button
              type="button"
              onClick={() => void addTimer()}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-black transition disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add and start
            </button>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Timers"
          accent="green"
          right={<MonoLabel className="text-white/25">{timers.length}</MonoLabel>}
        />
        {timers.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-white/30">
            {loading ? "Loading…" : "No timers yet."}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {timers.map((timer, index) => {
              const state = timerState(timer)
              const left = remainingSeconds(timer)
              return (
                <li key={timer.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  <span className="flex w-16 shrink-0 flex-col gap-1">
                    <span
                      className="font-mono text-[15px] tabular-nums leading-none"
                      style={{ color: state === "finished" ? "rgba(255,255,255,0.35)" : "#fff" }}
                    >
                      {timerReadout(timer)}
                    </span>
                    <Tag accent={STATE_ACCENT[state]}>{state}</Tag>
                  </span>

                  <span className="min-w-0 flex-1">
                    <input
                      value={timer.message}
                      aria-label="Timer label"
                      onChange={(event) =>
                        setTimers((current) =>
                          current.map((row) => (row.id === timer.id ? { ...row, message: event.target.value } : row)),
                        )
                      }
                      onBlur={(event) => {
                        const next = event.target.value.trim()
                        if (next && next !== timer.message) void patchTimer(timer.id, { message: next }, "Saved.")
                      }}
                      className="w-full bg-transparent text-[13px] text-white outline-none"
                    />
                    <MonoLabel className="text-white/25">
                      {formatDuration(timer.duration_seconds)} · at zero: {timer.on_zero}
                      {!timer.active && " · off"}
                    </MonoLabel>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    {state === "paused" ? (
                      <IconButton title="Resume" onClick={() => void patchTimer(timer.id, { action: "resume" })}>
                        <Play className="h-3.5 w-3.5" />
                      </IconButton>
                    ) : (
                      <IconButton
                        title="Pause"
                        disabled={state === "finished"}
                        onClick={() => void patchTimer(timer.id, { action: "pause" })}
                      >
                        <Pause className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                    <IconButton title="Restart" onClick={() => void patchTimer(timer.id, { action: "restart" })}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </IconButton>
                    <button
                      type="button"
                      onClick={() => void patchTimer(timer.id, { action: "extend", seconds: 300 })}
                      className="rounded border border-white/[0.10] px-2 py-1 text-[11px] text-white/45 transition hover:border-white/25 hover:text-white"
                    >
                      +5m
                    </button>
                    <button
                      type="button"
                      disabled={left <= 0}
                      onClick={() => void patchTimer(timer.id, { action: "extend", seconds: -300 })}
                      className="rounded border border-white/[0.10] px-2 py-1 text-[11px] text-white/45 transition hover:border-white/25 hover:text-white disabled:pointer-events-none disabled:opacity-25"
                    >
                      −5m
                    </button>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void patchTimer(timer.id, { active: !timer.active })}
                      className="rounded border px-2 py-1 text-[11px] transition"
                      style={
                        timer.active
                          ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                          : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.35)" }
                      }
                    >
                      {timer.active ? "On" : "Off"}
                    </button>
                    <IconButton title="Move up" disabled={index === 0} onClick={() => void moveTimer(index, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      title="Move down"
                      disabled={index === timers.length - 1}
                      onClick={() => void moveTimer(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <DeleteButton label="Remove timer" onConfirm={() => void removeTimer(timer.id)} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {/* --------------------------------------------------------- info */}

      <Panel accent="purple">
        <PanelHeader title="New info line" accent="purple" />
        <div className="space-y-3 p-3.5">
          <div>
            <label htmlFor="info-text" className="mb-1.5 block">
              <MonoLabel className="text-white/40">Text</MonoLabel>
            </label>
            <input
              id="info-text"
              value={infoText}
              onChange={(event) => setInfoText(event.target.value)}
              placeholder="!WIN: Thunder vs Underworld 250"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <IconPicker value={infoIcon} onChange={setInfoIcon} />
            <button
              type="button"
              onClick={() => void addInfo()}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-black transition disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.purple }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Info lines"
          accent="purple"
          right={<MonoLabel className="text-white/25">{infos.length}</MonoLabel>}
        />
        {infos.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[13px] text-white/30">
            {loading ? "Loading…" : "No info lines yet."}
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {infos.map((info) => (
              <li key={info.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                {info.data_url && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data URL */}
                    <img
                      src={info.data_url}
                      alt=""
                      className="h-5 w-5 shrink-0 object-contain"
                      style={{ filter: "brightness(0) saturate(100%) invert(1)" }}
                    />
                  </>
                )}
                <input
                  value={info.message}
                  aria-label="Info line"
                  onChange={(event) =>
                    setInfos((current) =>
                      current.map((row) => (row.id === info.id ? { ...row, message: event.target.value } : row)),
                    )
                  }
                  onBlur={(event) => {
                    const next = event.target.value.trim()
                    if (next && next !== info.message) void patchInfo(info.id, { message: next }, "Saved.")
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none"
                />
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void patchInfo(info.id, { active: !info.active })}
                    className="rounded border px-2 py-1 text-[11px] transition"
                    style={
                      info.active
                        ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                        : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.35)" }
                    }
                  >
                    {info.active ? "On" : "Off"}
                  </button>
                  <DeleteButton label="Remove info line" onConfirm={() => void removeInfo(info.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel accent="slate">
        <PanelHeader title="Spotify" accent="slate" />
        <p className="px-3.5 py-3 text-[13px] leading-relaxed text-white/45">
          The credentials form that used to be here saved to this browser&apos;s local storage, which the OBS source —
          a different browser — could never read. Nothing set the track, so the music line never appeared. It has been
          taken out rather than left looking like it works. Say the word and it can be built properly: credentials on
          the server, the now-playing track polled into the strip.
        </p>
      </Panel>
    </div>
  )
}
