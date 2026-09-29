"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getActiveHunt, type ActiveHunt, type HuntKpis } from "@/lib/active-hunt"
import { useToast } from "@/hooks/use-toast"
import {
  Crown,
  Crosshair,
  Flag,
  Gamepad2,
  GripVertical,
  History,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import { SlotCombobox } from "@/components/admin/slot-combobox"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

/**
 * The bonus hunt, from the admin side: start one, fill it, then open it.
 *
 * With no hunt running the page is the start form, next to how the last one
 * went. With one running it is the hunt: the figures, the form that adds a
 * bonus (picked from the slot catalogue, so the provider and artwork come
 * along), and the queue, which can be dragged into the order it will be
 * opened in.
 */

type HuntBonus = {
  id: string
  hunt_id: string
  game_name: string
  provider: string | null
  bet_size: number
  result: number | null
  created_at: string
  is_super: boolean
  image_url?: string | null
  position: number
}

const field =
  "h-9 w-full rounded-md border border-white/[0.10] bg-black/40 px-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"

const money = (value: number) =>
  `$${(Number(value) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <MonoLabel className="mb-1.5 block text-white/35">{label}</MonoLabel>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </label>
  )
}

function Thumb({ url, size = 40 }: { url?: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Gamepad2 className="h-4 w-4 text-white/15" />
      )}
    </span>
  )
}

function BonusRow({
  bonus,
  index,
  onDelete,
  onToggleSuper,
}: {
  bonus: HuntBonus
  index: number
  onDelete: (id: string) => void
  onToggleSuper: (id: string, isSuper: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bonus.id })
  const opened = bonus.result !== null
  const multi = opened && bonus.bet_size ? Number(bonus.result) / Number(bonus.bet_size) : null

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        ...(bonus.is_super ? { boxShadow: `inset 2px 0 0 ${ACCENTS.amber}` } : null),
      }}
      className="flex items-center gap-3 bg-[#0B0B0D] px-3 py-2.5"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="cursor-grab text-white/20 transition hover:text-white/60 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-5 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/25">{index + 1}</span>
      <Thumb url={bonus.image_url} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-white">
          {bonus.is_super && <Crown className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENTS.amber }} />}
          <span className="truncate">{bonus.game_name}</span>
        </p>
        <p className="truncate text-[11px] text-white/30">{bonus.provider ?? "—"}</p>
      </div>
      <div className="w-20 shrink-0 text-right">
        <MonoLabel className="block text-white/25">Bet</MonoLabel>
        <p className="text-[13px] tabular-nums text-white/80">{money(bonus.bet_size)}</p>
      </div>
      <div className="w-24 shrink-0 text-right">
        <MonoLabel className="block text-white/25">Result</MonoLabel>
        <p className="text-[13px] tabular-nums" style={{ color: opened ? ACCENTS.green : "rgba(255,255,255,0.25)" }}>
          {opened ? money(Number(bonus.result)) : "—"}
        </p>
      </div>
      <div className="hidden w-16 shrink-0 text-right sm:block">
        <MonoLabel className="block text-white/25">Multi</MonoLabel>
        <p className="text-[13px] tabular-nums" style={{ color: multi !== null ? ACCENTS.amber : "rgba(255,255,255,0.25)" }}>
          {multi !== null ? `${multi.toFixed(1)}x` : "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onToggleSuper(bonus.id, !bonus.is_super)}
          title={bonus.is_super ? "Remove Super" : "Mark as Super"}
          className="rounded p-1.5 transition hover:bg-white/[0.06]"
          style={{ color: bonus.is_super ? ACCENTS.amber : "rgba(255,255,255,0.25)" }}
        >
          <Crown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(bonus.id)}
          title="Delete"
          className="rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  )
}

export default function AdminBonusHuntPage() {
  const [loading, setLoading] = useState(true)
  const [activeHunt, setActiveHunt] = useState<ActiveHunt | null>(null)
  const [lastHunt, setLastHunt] = useState<HuntKpis | null>(null)
  const [bonuses, setBonuses] = useState<HuntBonus[]>([])
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newHunt, setNewHunt] = useState({ streamer: "", title: "", starting_balance: "" })
  const [draft, setDraft] = useState({
    game_name: "",
    provider: null as string | null,
    image_url: null as string | null,
    bet_size: "",
    result: "",
    is_super: false,
  })
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const { toast } = useToast()

  const fail = useCallback(
    (description: string) => toast({ title: "Error", description, variant: "destructive" }),
    [toast],
  )

  const loadBonuses = useCallback(
    async (huntId: string) => {
      const { data, error } = await supabase
        .from("hunt_bonuses")
        .select("*")
        .eq("hunt_id", huntId)
        .order("position", { ascending: true })
      if (error) console.error("[v0] Error fetching hunt bonuses:", error)
      else setBonuses((data || []) as HuntBonus[])
    },
    [supabase],
  )

  const load = useCallback(async () => {
    const hunt = await getActiveHunt(supabase)
    setActiveHunt(hunt)
    if (hunt) await loadBonuses(hunt.id)
    else {
      setBonuses([])
      // The last finished hunt: shown beside the start form, and its streamer
      // pre-fills the new one — it is nearly always the same name.
      const { data } = await supabase
        .from("bonus_hunt_kpis")
        .select("*")
        .eq("status", "ended")
        .order("ended_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const last = (data as HuntKpis | null) ?? null
      setLastHunt(last)
      if (last) setNewHunt((current) => (current.streamer ? current : { ...current, streamer: last.streamer }))
    }
    setLoading(false)
  }, [supabase, loadBonuses])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreateHunt(event: React.FormEvent) {
    event.preventDefault()
    if (!newHunt.streamer.trim() || !newHunt.starting_balance) {
      fail("A streamer and a starting balance are required.")
      return
    }
    setCreating(true)
    // Only ever one active hunt.
    await supabase.from("bonus_hunts").update({ status: "ended", ended_at: new Date().toISOString() }).eq("status", "active")

    const { data: created, error } = await supabase
      .from("bonus_hunts")
      .insert({
        streamer: newHunt.streamer.trim(),
        title: newHunt.title.trim() || null,
        starting_balance: Number.parseFloat(newHunt.starting_balance),
        status: "active",
      })
      .select("id, status, starting_balance, streamer, title, created_at, ended_at")
      .single()
    setCreating(false)

    if (error) {
      console.error("[v0] Error creating hunt:", error)
      fail("Could not create the hunt.")
      return
    }
    toast({ title: "Hunt started", description: "Add the bonuses as you buy them.", className: "bg-green-600 text-white" })
    setActiveHunt(created as ActiveHunt)
    setBonuses([])
    setNewHunt({ streamer: newHunt.streamer, title: "", starting_balance: "" })
  }

  async function handleAddBonus(event: React.FormEvent) {
    event.preventDefault()
    if (!activeHunt || !draft.game_name.trim() || !draft.bet_size) return
    setAdding(true)

    // New bonuses always join the end of the queue.
    const { error } = await supabase.from("hunt_bonuses").insert({
      game_name: draft.game_name.trim(),
      provider: draft.provider,
      image_url: draft.image_url,
      bet_size: Number.parseFloat(draft.bet_size),
      result: draft.result ? Number.parseFloat(draft.result) : null,
      is_super: draft.is_super,
      hunt_id: activeHunt.id,
      position: bonuses.length,
    })
    setAdding(false)

    if (error) {
      console.error("[v0] Error adding bonus:", error)
      fail("Could not add the bonus.")
      return
    }
    // The bet usually stays the same for the next bonus, so it is kept.
    setDraft((current) => ({ ...current, game_name: "", provider: null, image_url: null, result: "", is_super: false }))
    loadBonuses(activeHunt.id)
  }

  async function handleToggleSuper(id: string, isSuper: boolean) {
    const { error } = await supabase.from("hunt_bonuses").update({ is_super: isSuper }).eq("id", id)
    if (error) fail("Could not update the Super mark.")
    else setBonuses((prev) => prev.map((bonus) => (bonus.id === id ? { ...bonus, is_super: isSuper } : bonus)))
  }

  async function handleDeleteBonus(id: string) {
    if (!confirm("Delete this bonus?")) return
    const { error } = await supabase.from("hunt_bonuses").delete().eq("id", id)
    if (error) fail("Could not delete the bonus.")
    else setBonuses((prev) => prev.filter((bonus) => bonus.id !== id))
  }

  async function handleEndHunt() {
    if (!activeHunt) return
    if (!confirm("End this hunt? It moves to History and a new hunt can be started.")) return
    const { error } = await supabase
      .from("bonus_hunts")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", activeHunt.id)
    if (error) {
      console.error("[v0] Error ending hunt:", error)
      fail("Could not end the hunt.")
      return
    }
    toast({ title: "Hunt ended", description: "It is in History now.", className: "bg-green-600 text-white" })
    setLoading(true)
    load()
  }

  async function handleResetHunt() {
    if (!activeHunt) return
    if (!confirm("Reset this hunt? It deletes the hunt and every bonus in it, and cannot be undone.")) return

    const { error: predictionsError } = await supabase.from("hunt_predictions").delete().eq("hunt_id", activeHunt.id)
    if (predictionsError) console.error("[v0] Error deleting predictions:", predictionsError)
    await supabase.from("prediction_windows").delete().eq("hunt_id", activeHunt.id)
    await supabase.from("opening_state").upsert({ id: 1, is_opening: false })

    const { error: deleteBonusesError } = await supabase.from("hunt_bonuses").delete().eq("hunt_id", activeHunt.id)
    const { error: deleteError } = deleteBonusesError
      ? { error: deleteBonusesError }
      : await supabase.from("bonus_hunts").delete().eq("id", activeHunt.id)

    if (deleteError) {
      console.error("[v0] Error deleting hunt:", deleteError)
      fail("Could not reset the hunt.")
      return
    }
    toast({ title: "Hunt reset", className: "bg-green-600 text-white" })
    setLoading(true)
    load()
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = bonuses.findIndex((bonus) => bonus.id === active.id)
    const newIndex = bonuses.findIndex((bonus) => bonus.id === over.id)
    const reordered = arrayMove(bonuses, oldIndex, newIndex)
    setBonuses(reordered)

    // Persist the new order to the stable `position` column (the source of
    // truth the extension reads as `order`). created_at is left untouched so
    // it keeps reflecting true insertion time.
    await Promise.all(
      reordered.map((bonus, i) => supabase.from("hunt_bonuses").update({ position: i }).eq("id", bonus.id)),
    )
  }

  const figures = useMemo(() => {
    const totalBet = bonuses.reduce((sum, bonus) => sum + (Number(bonus.bet_size) || 0), 0)
    const opened = bonuses.filter((bonus) => bonus.result !== null)
    const won = opened.reduce((sum, bonus) => sum + (Number(bonus.result) || 0), 0)
    const start = Number(activeHunt?.starting_balance) || 0
    return {
      totalBet,
      opened: opened.length,
      won,
      // The average multiplier every bonus has to hit for the hunt to break even.
      breakEven: totalBet > 0 ? start / totalBet : null,
    }
  }, [bonuses, activeHunt])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    )
  }

  // --- no hunt running --------------------------------------------------------
  if (!activeHunt) {
    const lastProfit = lastHunt ? Number(lastHunt.total_won) - Number(lastHunt.starting_balance) : 0
    return (
      <div className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Bonus Hunt</h1>
            <p className="mt-1 text-[13px] text-white/40">No hunt is running. Start one to add bonuses.</p>
          </div>
          <Link
            href="/admin/history"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <History className="h-3.5 w-3.5" /> History
          </Link>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel accent="green">
            <PanelHeader title="Start a new hunt" accent="green" />
            <form onSubmit={handleCreateHunt} className="space-y-3 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Streamer">
                  <input
                    value={newHunt.streamer}
                    onChange={(e) => setNewHunt({ ...newHunt, streamer: e.target.value })}
                    placeholder="e.g. TrinidoSlots"
                    className={field}
                    required
                  />
                </Field>
                <Field label="Title" hint="Optional.">
                  <input
                    value={newHunt.title}
                    onChange={(e) => setNewHunt({ ...newHunt, title: e.target.value })}
                    placeholder="e.g. Friday Night Hunt"
                    className={field}
                  />
                </Field>
              </div>
              <Field label="Starting balance ($)" hint="What goes into buying the bonuses.">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newHunt.starting_balance}
                  onChange={(e) => setNewHunt({ ...newHunt, starting_balance: e.target.value })}
                  placeholder="0.00"
                  className={`${field} tabular-nums`}
                  required
                />
              </Field>
              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: ACCENTS.green }}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Start hunt
              </button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader
              title="Last hunt"
              accent="slate"
              right={
                lastHunt?.ended_at ? (
                  <MonoLabel className="text-white/25">{new Date(lastHunt.ended_at).toLocaleDateString()}</MonoLabel>
                ) : null
              }
            />
            {lastHunt ? (
              <div className="p-4">
                <p className="text-[14px] font-medium text-white">
                  {lastHunt.streamer}
                  {lastHunt.title ? <span className="text-white/40"> · {lastHunt.title}</span> : null}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  <Figure label="Start" value={money(Number(lastHunt.starting_balance))} />
                  <Figure label="Won" value={money(Number(lastHunt.total_won))} color={ACCENTS.green} />
                  <Figure
                    label="Profit / loss"
                    value={`${lastProfit >= 0 ? "+" : "-"}${money(Math.abs(lastProfit))}`}
                    color={lastProfit >= 0 ? ACCENTS.green : ACCENTS.red}
                  />
                  <Figure label="Bonuses" value={String(lastHunt.total_bonuses)} />
                  <Figure label="Best multi" value={`${Number(lastHunt.best_multiplier).toFixed(1)}x`} color={ACCENTS.amber} />
                  <Figure label="Average multi" value={`${Number(lastHunt.average_multi).toFixed(1)}x`} color={ACCENTS.amber} />
                </dl>
              </div>
            ) : (
              <p className="px-4 py-10 text-center text-[13px] text-white/30">No finished hunts yet.</p>
            )}
          </Panel>
        </div>
      </div>
    )
  }

  // --- a hunt is running --------------------------------------------------------
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {activeHunt.title || `${activeHunt.streamer}'s hunt`}
            </h1>
            <Tag accent="green">Live</Tag>
          </div>
          <p className="mt-1 text-[13px] text-white/40">
            {activeHunt.streamer} · started {new Date(activeHunt.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleResetHunt}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/45 transition hover:border-[#E5484D]/40 hover:text-[#E5484D]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={handleEndHunt}
            className="inline-flex h-9 items-center gap-2 rounded-md border px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] transition hover:brightness-125"
            style={{ borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }}
          >
            <Flag className="h-3.5 w-3.5" /> End hunt
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/bonushunt/opening")}
            className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition hover:brightness-110"
            style={{ backgroundColor: ACCENTS.blue }}
          >
            <Play className="h-3.5 w-3.5" /> Opening mode
          </button>
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Starting balance" value={money(Number(activeHunt.starting_balance))} />
        <StatTile label="Bonuses" value={bonuses.length.toLocaleString()} accent="blue" />
        <StatTile label="Total bet" value={money(figures.totalBet)} accent="red" />
        <StatTile
          label="Opened"
          value={`${figures.opened}/${bonuses.length}`}
          accent="green"
          hint={figures.opened ? `${money(figures.won)} won` : undefined}
        />
        <StatTile
          label="Break-even"
          value={figures.breakEven !== null ? `${figures.breakEven.toFixed(1)}x` : "—"}
          accent="amber"
          hint="Average multi needed"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Panel accent="blue" className="lg:sticky lg:top-20">
          <PanelHeader title="Add a bonus" />
          <form onSubmit={handleAddBonus} className="space-y-3 p-4">
            <Field label="Slot">
              <SlotCombobox
                value={draft.game_name}
                onChange={(game_name, provider, image_url) =>
                  setDraft((current) => ({ ...current, game_name, provider, image_url: image_url ?? null }))
                }
                placeholder="Search the catalogue or type a name"
              />
            </Field>
            {draft.game_name && (
              <div className="flex items-center gap-2.5 rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                <Thumb url={draft.image_url} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-white">{draft.game_name}</p>
                  <p className="truncate text-[11px] text-white/30">{draft.provider ?? "Not in the catalogue"}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bet ($)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.bet_size}
                  onChange={(e) => setDraft({ ...draft, bet_size: e.target.value })}
                  placeholder="0.00"
                  className={`${field} tabular-nums`}
                  required
                />
              </Field>
              <Field label="Result ($)" hint="Optional.">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.result}
                  onChange={(e) => setDraft({ ...draft, result: e.target.value })}
                  placeholder="—"
                  className={`${field} tabular-nums`}
                />
              </Field>
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60">
              <input
                type="checkbox"
                checked={draft.is_super}
                onChange={(e) => setDraft({ ...draft, is_super: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#E8A33D]"
              />
              <Crown className="h-3.5 w-3.5" style={{ color: ACCENTS.amber }} /> Super bonus
            </label>
            <button
              type="submit"
              disabled={adding || !draft.game_name.trim() || !draft.bet_size}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-black transition hover:brightness-110 disabled:opacity-40"
              style={{ backgroundColor: ACCENTS.blue }}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add to hunt
            </button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Bonuses"
            accent="slate"
            right={<MonoLabel className="text-white/25">Drag to reorder</MonoLabel>}
          />
          {bonuses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <Crosshair className="h-7 w-7 text-white/10" />
              <p className="text-[13px] text-white/30">No bonuses yet – add the first one on the left.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={bonuses.map((bonus) => bonus.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-white/[0.05]">
                  {bonuses.map((bonus, index) => (
                    <BonusRow
                      key={bonus.id}
                      bonus={bonus}
                      index={index}
                      onDelete={handleDeleteBonus}
                      onToggleSuper={handleToggleSuper}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <MonoLabel className="block text-white/30">{label}</MonoLabel>
      <p className="mt-1 text-[15px] font-semibold tabular-nums" style={{ color: color ?? "#E7E7EA" }}>
        {value}
      </p>
    </div>
  )
}
