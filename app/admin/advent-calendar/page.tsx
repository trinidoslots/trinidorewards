"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Dices, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Shuffle, Sparkles, Trash2, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { FIELD_CLASS, SelectMenu } from "@/components/ui/select-menu"
import {
  DEFAULT_OPTIONS,
  DEFAULT_POOL,
  DOORS,
  TIERS,
  generateCalendar,
  generateDay,
  parseDays,
  toPercentages,
  utcDay,
  type AdventReward,
  type DraftReward,
  type GenerateOptions,
  type RewardTemplate,
  type Tier,
} from "@/lib/advent"

/**
 * The advent calendar's doors and what is behind them.
 *
 * Every door can be edited by hand, rerolled from the reward pool, or the
 * whole calendar generated in one go. Generated calendars are a preview until
 * saved, so a roll you do not like costs nothing.
 *
 * Saving never deletes a reward somebody has already won. Claims reference
 * their reward with ON DELETE CASCADE, so deleting one took every claim on it
 * with it — editing a door in December used to erase that day's winners. A
 * won reward that is replaced is switched off instead: gone from the door,
 * kept for the claims.
 */

const DAYS = Array.from({ length: DOORS }, (_, index) => index + 1)
const POOL_KEY = "advent-pool"
const OPTIONS_KEY = "advent-options"

type Row = DraftReward & { key: string }
type Claim = { day_number: number; reward_id: string }

let keySeed = 0
const withKey = (reward: DraftReward): Row => ({ ...reward, key: reward.id ?? `new-${++keySeed}` })

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private windows and blocked storage: the pool just is not remembered.
  }
}

const sumOf = (rows: { probability: number }[]) =>
  Math.round(rows.reduce((sum, row) => sum + (Number(row.probability) || 0), 0) * 100) / 100

/** Why a door's rewards cannot be saved, or null. */
function problemWith(rows: Row[]): string | null {
  if (rows.length === 0) return null
  if (rows.some((row) => !row.title.trim())) return "Every reward needs a title."
  if (rows.some((row) => !(Number(row.probability) > 0) || Number(row.probability) > 100)) {
    return "Every chance has to be above 0 and at most 100."
  }
  const total = sumOf(rows)
  if (Math.abs(total - 100) > 0.01) return `The chances add up to ${total}%, not 100%.`
  return null
}

export default function AdminAdventCalendarPage() {
  const supabaseRef = useRef(createClient())
  const [rewards, setRewards] = useState<AdventReward[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [pool, setPool] = useState<RewardTemplate[]>(DEFAULT_POOL)
  const [options, setOptions] = useState<GenerateOptions>(DEFAULT_OPTIONS)
  const [bigDaysText, setBigDaysText] = useState(DEFAULT_OPTIONS.bigDays.join(", "))
  const [draft, setDraft] = useState<{ kind: "generated" | "shuffled"; days: Record<number, DraftReward[]> } | null>(null)
  const [editing, setEditing] = useState<{ day: number; rows: Row[]; rerolled: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)

  // The pool and options are per admin and per browser: a working setup, not site data.
  useEffect(() => {
    setPool(readStored(POOL_KEY, DEFAULT_POOL))
    const stored = readStored(OPTIONS_KEY, DEFAULT_OPTIONS)
    setOptions(stored)
    setBigDaysText(stored.bigDays.join(", "))
  }, [])
  useEffect(() => writeStored(POOL_KEY, pool), [pool])
  useEffect(() => writeStored(OPTIONS_KEY, options), [options])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = supabaseRef.current
    const [rewardsResult, claimsResult] = await Promise.all([
      supabase.from("advent_calendar_rewards").select("*").order("day_number").order("display_order"),
      supabase.from("advent_calendar_claims").select("day_number, reward_id"),
    ])
    if (rewardsResult.error) setError(rewardsResult.error.message || "Could not load the rewards.")
    else setRewards((rewardsResult.data ?? []) as AdventReward[])
    if (!claimsResult.error) setClaims((claimsResult.data ?? []) as Claim[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** What each door shows now: the draft if there is one, else the saved, active rewards. */
  const doors = useMemo(() => {
    const result: Record<number, DraftReward[]> = {}
    for (const day of DAYS) {
      result[day] = draft
        ? (draft.days[day] ?? [])
        : rewards
            .filter((reward) => reward.day_number === day && reward.is_active)
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    }
    return result
  }, [draft, rewards])

  const claimsByDay = useMemo(() => {
    const counts = new Map<number, number>()
    for (const claim of claims) counts.set(claim.day_number, (counts.get(claim.day_number) ?? 0) + 1)
    return counts
  }, [claims])

  const filled = DAYS.filter((day) => doors[day].length > 0).length
  const today = utcDay().month === 11 ? utcDay().day : null

  /**
   * Replace the rewards of the given doors.
   *
   * Rows with an id are updated, rows without are inserted, and saved rewards
   * no longer listed are deleted — or, when somebody has won them, switched
   * off. Inserts and updates go first, so a failure part way leaves a door
   * with too much on it rather than with nothing.
   */
  async function saveDoors(next: Record<number, DraftReward[]>) {
    const supabase = supabaseRef.current
    const days = Object.keys(next).map(Number)
    const listed = new Set(days.flatMap((day) => next[day].map((reward) => reward.id).filter(Boolean) as string[]))
    const won = new Set(claims.map((claim) => claim.reward_id))
    const replaced = rewards.filter((reward) => days.includes(reward.day_number) && reward.is_active && !listed.has(reward.id))

    const fields = (reward: DraftReward, index: number) => ({
      day_number: reward.day_number,
      title: reward.title.trim(),
      description: reward.description?.trim() || reward.title.trim(),
      icon: reward.icon || "🎁",
      reward_type: reward.reward_type || "bonus",
      reward_value: reward.reward_value?.trim() || reward.title.trim(),
      probability: Number(reward.probability),
      display_order: index,
      is_active: true,
    })

    const inserts = days.flatMap((day) => next[day].map(fields).filter((_, index) => !next[day][index].id))
    if (inserts.length > 0) {
      const { error: problem } = await supabase.from("advent_calendar_rewards").insert(inserts)
      if (problem) throw problem
    }
    for (const day of days) {
      for (const [index, reward] of next[day].entries()) {
        if (!reward.id) continue
        const { error: problem } = await supabase.from("advent_calendar_rewards").update(fields(reward, index)).eq("id", reward.id)
        if (problem) throw problem
      }
    }

    const retire = replaced.filter((reward) => won.has(reward.id)).map((reward) => reward.id)
    const remove = replaced.filter((reward) => !won.has(reward.id)).map((reward) => reward.id)
    if (retire.length > 0) {
      const { error: problem } = await supabase.from("advent_calendar_rewards").update({ is_active: false }).in("id", retire)
      if (problem) throw problem
    }
    if (remove.length > 0) {
      const { error: problem } = await supabase.from("advent_calendar_rewards").delete().in("id", remove)
      if (problem) throw problem
    }
    return { retired: retire.length }
  }

  async function run(task: () => Promise<{ retired: number }>, done: string) {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const { retired } = await task()
      setNotice(
        retired > 0
          ? `${done} ${retired} already-won ${retired === 1 ? "reward was" : "rewards were"} switched off instead of deleted, so the claims stay.`
          : done,
      )
      await load()
      return true
    } catch (problem) {
      setError((problem as { message?: string })?.message || "Could not save.")
      return false
    } finally {
      setSaving(false)
    }
  }

  /* --------------------------- generator actions --------------------------- */

  function generateAll() {
    setConfirmAll(false)
    setDraft({ kind: "generated", days: generateCalendar(pool, options) })
  }

  /** The doors' current contents, moved to other doors at random. Doors already won stay where they are. */
  function shuffleDoors() {
    setConfirmAll(false)
    const fixed = DAYS.filter((day) => (claimsByDay.get(day) ?? 0) > 0)
    const movable = DAYS.filter((day) => !fixed.includes(day))
    const contents = movable.map((day) => doors[day])
    for (let index = contents.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[contents[index], contents[other]] = [contents[other], contents[index]]
    }
    const days: Record<number, DraftReward[]> = {}
    movable.forEach((day, index) => {
      days[day] = contents[index].map((reward, order) => ({ ...reward, id: undefined, day_number: day, display_order: order }))
    })
    for (const day of fixed) days[day] = doors[day]
    setDraft({ kind: "shuffled", days })
  }

  async function saveDraft() {
    if (!draft) return
    const ok = await run(
      () => saveDoors(draft.days),
      draft.kind === "generated" ? "The generated calendar is saved." : "The shuffled doors are saved.",
    )
    if (ok) {
      setDraft(null)
      setConfirmAll(false)
    }
  }

  function openEditor(day: number, reroll = false) {
    const rows = reroll
      ? generateDay(day, pool, options, Math.random, doors[day - 1]?.map((reward) => reward.title) ?? [])
      : doors[day]
    setEditing({ day, rows: rows.map(withKey), rerolled: reroll })
  }

  async function saveEditor() {
    if (!editing) return
    const problem = problemWith(editing.rows)
    if (problem) {
      setError(problem)
      return
    }
    const rows = editing.rows.map(({ key: _key, ...reward }) => ({ ...reward, day_number: editing.day }))
    const ok = await run(() => saveDoors({ [editing.day]: rows }), `Door ${editing.day} is saved.`)
    if (ok) setEditing(null)
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Advent calendar</h1>
          <p className="mt-1 text-[13px] text-white/40">
            What is behind each of the 24 doors. Doors open at 00:00 GMT. Opening a door records the win; rewards are handed out by hand.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {(error || notice) && (
        <Panel
          accent={error ? "red" : "green"}
          className="flex items-center gap-2 px-3.5 py-2.5 text-[13px]"
          style={{ color: error ? ACCENTS.red : ACCENTS.green }}
        >
          {error ?? notice}
          <button
            type="button"
            onClick={() => {
              setError(null)
              setNotice(null)
            }}
            aria-label="Dismiss"
            className="ml-auto rounded p-1 text-white/25 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Doors filled" value={`${filled}/${DOORS}`} accent={filled === DOORS ? "green" : "amber"} />
        <StatTile label="Rewards" value={DAYS.reduce((sum, day) => sum + doors[day].length, 0).toLocaleString()} accent="blue" />
        <StatTile label="Doors opened" value={claims.length.toLocaleString()} accent="green" hint="All users, all doors" />
        <StatTile
          label="Today"
          value={today && today <= DOORS ? `Door ${today}` : "—"}
          hint={today ? `${claimsByDay.get(today) ?? 0} opened so far` : "Doors open 1 to 24 December"}
          accent="red"
        />
      </div>

      <Generator
        pool={pool}
        setPool={setPool}
        options={options}
        setOptions={setOptions}
        bigDaysText={bigDaysText}
        setBigDaysText={setBigDaysText}
        onGenerate={generateAll}
        onShuffle={shuffleDoors}
        hasClaims={claims.length > 0}
      />

      {draft && (
        <Panel accent="amber" className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Sparkles className="h-4 w-4" style={{ color: ACCENTS.amber }} />
          <p className="text-[13px] text-white/80">
            {draft.kind === "generated" ? "A generated calendar" : "The doors shuffled"} is shown below.{" "}
            <span className="text-white/45">Nothing is saved yet.</span>
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <SmallButton onClick={draft.kind === "generated" ? generateAll : shuffleDoors} icon={<Dices className="h-3.5 w-3.5" />}>
              {draft.kind === "generated" ? "Generate again" : "Shuffle again"}
            </SmallButton>
            <SmallButton onClick={() => setDraft(null)} icon={<X className="h-3.5 w-3.5" />}>
              Discard
            </SmallButton>
            {confirmAll ? (
              <SmallButton onClick={saveDraft} strong disabled={saving} icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}>
                Replace all {DOORS} doors?
              </SmallButton>
            ) : (
              <SmallButton onClick={() => setConfirmAll(true)} strong>
                Save calendar
              </SmallButton>
            )}
          </div>
        </Panel>
      )}

      {loading && rewards.length === 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS.map((day) => (
            <div key={day} className="h-40 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS.map((day) => (
            <DoorCard
              key={day}
              day={day}
              rewards={doors[day]}
              opened={claimsByDay.get(day) ?? 0}
              isToday={today === day}
              isDraft={!!draft}
              onEdit={() => openEditor(day)}
              onReroll={() => openEditor(day, true)}
            />
          ))}
        </div>
      )}

      <DoorEditor
        editing={editing}
        setEditing={setEditing}
        saving={saving}
        onSave={saveEditor}
        onReroll={() => editing && openEditor(editing.day, true)}
        opened={editing ? (claimsByDay.get(editing.day) ?? 0) : 0}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Generator                                 */
/* -------------------------------------------------------------------------- */

function Generator({
  pool,
  setPool,
  options,
  setOptions,
  bigDaysText,
  setBigDaysText,
  onGenerate,
  onShuffle,
  hasClaims,
}: {
  pool: RewardTemplate[]
  setPool: React.Dispatch<React.SetStateAction<RewardTemplate[]>>
  options: GenerateOptions
  setOptions: React.Dispatch<React.SetStateAction<GenerateOptions>>
  bigDaysText: string
  setBigDaysText: (value: string) => void
  onGenerate: () => void
  onShuffle: () => void
  hasClaims: boolean
}) {
  const [open, setOpen] = useState(true)
  const update = (index: number, change: Partial<RewardTemplate>) =>
    setPool((current) => current.map((template, at) => (at === index ? { ...template, ...change } : template)))

  return (
    <Panel>
      <PanelHeader
        title="Generator"
        accent="amber"
        right={
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-white/40 transition hover:text-white"
          >
            {open ? "Hide" : "Show"}
          </button>
        }
      />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
              {/* The pool */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <MonoLabel className="text-white/40">Reward pool · {pool.length}</MonoLabel>
                  <button
                    type="button"
                    onClick={() => setPool(DEFAULT_POOL)}
                    className="inline-flex items-center gap-1.5 text-[11.5px] text-white/35 transition hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset to the starting pool
                  </button>
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="hidden grid-cols-[3.25rem_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_2rem] gap-1.5 px-0.5 md:grid">
                    {["Icon", "Title", "Value", "Tier", ""].map((label) => (
                      <MonoLabel key={label} className="text-white/25">
                        {label}
                      </MonoLabel>
                    ))}
                  </div>
                  {pool.map((template, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[3.25rem_minmax(0,1fr)_2rem] gap-1.5 md:grid-cols-[3.25rem_minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_2rem]"
                    >
                      <input
                        aria-label="Icon"
                        value={template.icon}
                        onChange={(event) => update(index, { icon: event.target.value })}
                        className={`${FIELD_CLASS} text-center`}
                      />
                      <input
                        aria-label="Title"
                        value={template.title}
                        onChange={(event) => update(index, { title: event.target.value })}
                        placeholder="250 points"
                        className={FIELD_CLASS}
                      />
                      <input
                        aria-label="Value"
                        value={template.value}
                        onChange={(event) => update(index, { value: event.target.value })}
                        placeholder="Shown when won"
                        className={`${FIELD_CLASS} col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-auto md:row-start-auto`}
                      />
                      <div className="col-span-2 col-start-2 row-start-3 md:col-span-1 md:col-start-auto md:row-start-auto">
                        <SelectMenu
                          aria-label="Tier"
                          value={template.tier}
                          onChange={(value) => update(index, { tier: value as Tier })}
                          options={TIERS.map((tier) => ({ value: tier.id, label: tier.label }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setPool((current) => current.filter((_, at) => at !== index))}
                        aria-label="Remove from the pool"
                        className="col-start-3 row-start-1 flex h-9 items-center justify-center rounded-md text-white/30 transition hover:bg-white/[0.06] hover:text-[#E5484D] md:col-start-auto md:row-start-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPool((current) => [...current, { icon: "🎁", title: "", value: "", tier: "common" }])}
                  className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-white/[0.14] px-3 text-[12px] text-white/50 transition hover:border-white/30 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Add to the pool
                </button>
                <p className="mt-3 text-[11.5px] leading-relaxed text-white/30">
                  Common rewards are picked most often and get the biggest chance behind a door; epic ones are rare and
                  get the smallest. The pool is remembered in this browser.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <div>
                  <MonoLabel className="mb-1.5 block text-white/40">Rewards per door</MonoLabel>
                  <Segmented
                    value={String(options.perDoor)}
                    onChange={(value) => setOptions((current) => ({ ...current, perDoor: Number(value) }))}
                    options={["1", "2", "3", "4"].map((value) => ({ value, label: value }))}
                  />
                </div>
                <div>
                  <MonoLabel className="mb-1.5 block text-white/40">Big doors</MonoLabel>
                  <input
                    value={bigDaysText}
                    onChange={(event) => setBigDaysText(event.target.value)}
                    onBlur={() => {
                      const days = parseDays(bigDaysText)
                      setOptions((current) => ({ ...current, bigDays: days }))
                      setBigDaysText(days.join(", "))
                    }}
                    placeholder="6, 12, 18, 24"
                    className={FIELD_CLASS}
                  />
                  <p className="mt-1 text-[11.5px] text-white/30">Only rare and epic rewards, at least one epic.</p>
                </div>
                <div>
                  <MonoLabel className="mb-1.5 block text-white/40">Chances</MonoLabel>
                  <Segmented
                    value={options.odds}
                    onChange={(value) => setOptions((current) => ({ ...current, odds: value as GenerateOptions["odds"] }))}
                    options={[
                      { value: "weighted", label: "By tier" },
                      { value: "even", label: "Even" },
                    ]}
                  />
                </div>
                <div className="space-y-2 border-t border-white/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={pool.filter((template) => template.title.trim()).length === 0}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-40"
                    style={{ backgroundColor: ACCENTS.amber }}
                  >
                    <Sparkles className="h-4 w-4" /> Generate all {DOORS} doors
                  </button>
                  <button
                    type="button"
                    onClick={onShuffle}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/[0.12] text-[13px] font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
                  >
                    <Shuffle className="h-4 w-4" /> Shuffle the doors
                  </button>
                  <p className="text-[11.5px] leading-relaxed text-white/30">
                    Both show a preview first.{hasClaims ? " Doors somebody has already opened are not moved by a shuffle." : ""}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex gap-1 rounded-md border border-white/[0.10] bg-black/30 p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="h-7 flex-1 rounded text-[12.5px] font-semibold transition"
            style={active ? { backgroundColor: ACCENTS.amber, color: "#000" } : { color: "rgba(255,255,255,0.5)" }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SmallButton({
  children,
  icon,
  strong,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; strong?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold transition hover:brightness-110 disabled:opacity-50"
      style={
        strong
          ? { backgroundColor: ACCENTS.green, borderColor: ACCENTS.green, color: "#000" }
          : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }
      }
    >
      {icon}
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Door card                                 */
/* -------------------------------------------------------------------------- */

function DoorCard({
  day,
  rewards,
  opened,
  isToday,
  isDraft,
  onEdit,
  onReroll,
}: {
  day: number
  rewards: DraftReward[]
  opened: number
  isToday: boolean
  isDraft: boolean
  onEdit: () => void
  onReroll: () => void
}) {
  return (
    <Panel
      accent={isToday ? "red" : isDraft ? "amber" : undefined}
      className="flex flex-col p-3.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-[20px] font-black tabular-nums text-white">{day}</span>
        <MonoLabel className="text-white/30">Dec</MonoLabel>
        {isToday && <Tag accent="red">Today</Tag>}
        {day === DOORS && <Tag accent="amber">Finale</Tag>}
        <span className="ml-auto text-[11.5px] tabular-nums text-white/40" title="Times this door was opened">
          {opened} opened
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-1.5">
        {rewards.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/[0.10] px-3 py-4 text-center text-[12px] text-white/30">
            Nothing behind this door
          </p>
        ) : (
          rewards.map((reward, index) => (
            <div key={reward.id ?? index}>
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="w-5 text-center">{reward.icon}</span>
                <span className="min-w-0 flex-1 truncate text-white/85">{reward.title}</span>
                <span className="shrink-0 tabular-nums text-white/50">{Number(reward.probability)}%</span>
              </div>
              <div className="ml-7 mt-1 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Number(reward.probability))}%`,
                    backgroundColor: reward.reward_type === "epic" ? ACCENTS.purple : reward.reward_type === "rare" ? ACCENTS.blue : "rgba(255,255,255,0.35)",
                  }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {!isDraft && (
        <div className="mt-3 flex gap-1.5 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.10] text-[12px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onReroll}
            title="Reroll this door from the pool"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/[0.10] px-2.5 text-[12px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
          >
            <Dices className="h-3.5 w-3.5" /> Randomize
          </button>
        </div>
      )}
    </Panel>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Door editor                                */
/* -------------------------------------------------------------------------- */

function DoorEditor({
  editing,
  setEditing,
  saving,
  onSave,
  onReroll,
  opened,
}: {
  editing: { day: number; rows: Row[]; rerolled: boolean } | null
  setEditing: React.Dispatch<React.SetStateAction<{ day: number; rows: Row[]; rerolled: boolean } | null>>
  saving: boolean
  onSave: () => void
  onReroll: () => void
  opened: number
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const rows = editing?.rows ?? []
  const total = sumOf(rows)
  const problem = problemWith(rows)
  const setRows = (next: Row[]) => setEditing((current) => (current ? { ...current, rows: next } : current))
  const update = (key: string, change: Partial<Row>) => setRows(rows.map((row) => (row.key === key ? { ...row, ...change } : row)))

  return createPortal(
    <AnimatePresence>
      {editing && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null)
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Door ${editing.day}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-white/[0.10] bg-[#0E0E11]"
          >
            <header className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
              <MonoLabel className="text-white/70">Door {editing.day}</MonoLabel>
              {editing.rerolled && <Tag accent="amber">Rerolled, not saved</Tag>}
              {opened > 0 && <Tag accent="green">{opened} opened</Tag>}
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                className="ml-auto rounded p-1.5 text-white/30 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {rows.length === 0 && (
                <p className="rounded-md border border-dashed border-white/[0.10] px-3 py-6 text-center text-[12.5px] text-white/35">
                  No rewards. Saving leaves this door empty.
                </p>
              )}
              {rows.map((row) => (
                <div key={row.key} className="space-y-1.5 rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5">
                  <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_5.5rem_2rem] gap-1.5">
                    <input
                      aria-label="Icon"
                      value={row.icon}
                      onChange={(event) => update(row.key, { icon: event.target.value })}
                      className={`${FIELD_CLASS} text-center`}
                    />
                    <input
                      aria-label="Title"
                      value={row.title}
                      onChange={(event) => update(row.key, { title: event.target.value })}
                      placeholder="Title"
                      className={FIELD_CLASS}
                    />
                    <div className="relative">
                      <input
                        aria-label="Chance in percent"
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={row.probability}
                        onChange={(event) => update(row.key, { probability: Number.parseFloat(event.target.value) || 0 })}
                        className={`${FIELD_CLASS} pr-6 tabular-nums`}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-white/30">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
                      aria-label="Remove reward"
                      className="flex h-9 items-center justify-center rounded-md text-white/30 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <input
                      aria-label="Value"
                      value={row.reward_value ?? ""}
                      onChange={(event) => update(row.key, { reward_value: event.target.value })}
                      placeholder="Value, shown when won"
                      className={FIELD_CLASS}
                    />
                    <input
                      aria-label="Description"
                      value={row.description}
                      onChange={(event) => update(row.key, { description: event.target.value })}
                      placeholder="Description"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <SmallButton
                  onClick={() =>
                    setRows([
                      ...rows,
                      withKey({
                        day_number: editing.day,
                        title: "",
                        description: "",
                        icon: "🎁",
                        reward_type: "common",
                        reward_value: "",
                        probability: 0,
                        display_order: rows.length,
                      }),
                    ])
                  }
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Add reward
                </SmallButton>
                <SmallButton
                  onClick={() => {
                    const even = toPercentages(rows.map(() => 1))
                    setRows(rows.map((row, index) => ({ ...row, probability: even[index] })))
                  }}
                  disabled={rows.length === 0}
                >
                  Even chances
                </SmallButton>
                <SmallButton onClick={onReroll} icon={<Dices className="h-3.5 w-3.5" />}>
                  Randomize from pool
                </SmallButton>
              </div>
            </div>

            <footer className="flex items-center gap-3 border-t border-white/[0.08] px-4 py-3">
              <span
                className="text-[12.5px] tabular-nums"
                style={{ color: rows.length === 0 || Math.abs(total - 100) <= 0.01 ? ACCENTS.green : ACCENTS.red }}
              >
                {rows.length === 0 ? "Empty door" : `Total ${total}%`}
              </span>
              {problem && rows.length > 0 && <span className="truncate text-[12px] text-white/40">{problem}</span>}
              <div className="ml-auto flex gap-2">
                <SmallButton onClick={() => setEditing(null)}>Cancel</SmallButton>
                <SmallButton onClick={onSave} strong disabled={saving || !!problem} icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : undefined}>
                  Save door
                </SmallButton>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
