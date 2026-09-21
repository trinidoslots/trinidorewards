"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, StatTile, Tag } from "@/components/ui/panel"
import { inStock, isAvailable, isUnlimited, stockLabel, type StoreItem } from "@/lib/store"

/**
 * The store, from the admin side.
 *
 * Availability is a text column, so it is read and written through the shared
 * helper rather than each page inventing its own truthiness — that mismatch is
 * what let a disabled item stay purchasable.
 */
export default function AdminStorePage() {
  const supabaseRef = useRef(createClient())

  const [items, setItems] = useState<StoreItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("store_items")
      .select("*")
      .order("created_at", { ascending: false })

    if (problem) {
      console.error("[v0] Error fetching store items:", problem)
      setError(problem.message || "Could not load the store")
    } else {
      setItems((data ?? []) as StoreItem[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(needle) ||
        (item.category ?? "").toLowerCase().includes(needle) ||
        (item.description ?? "").toLowerCase().includes(needle),
    )
  }, [items, query])

  const totals = useMemo(
    () => ({
      items: items.length,
      live: items.filter((item) => isAvailable(item) && inStock(item)).length,
      out: items.filter((item) => !inStock(item)).length,
    }),
    [items],
  )

  async function toggleAvailable(item: StoreItem) {
    const next = isAvailable(item) ? "false" : "true"
    const { error: problem } = await supabaseRef.current
      .from("store_items")
      .update({ is_available: next })
      .eq("id", item.id)

    if (problem) {
      setError(problem.message || "Could not update that item")
      return
    }
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, is_available: next } : entry)),
    )
  }

  async function remove(item: StoreItem) {
    if (!confirm(`Delete "${item.name}" from the store?`)) return
    const { error: problem } = await supabaseRef.current.from("store_items").delete().eq("id", item.id)
    if (problem) {
      // 23503 is a foreign key violation: somebody has bought this, and
      // redemptions still points at it. scripts/058 changes that reference to
      // ON DELETE SET NULL — the purchase keeps its own copy of the name and
      // price, so nothing is lost. Until it has been run, say what to do
      // instead of showing the raw constraint name.
      setError(
        problem.code === "23503"
          ? `"${item.name}" has already been bought, so it cannot be deleted until scripts/058_store_items_deletable.sql has been run in Supabase. Disabling it hides it from the store in the meantime.`
          : problem.message || "Could not delete that item",
      )
      return
    }
    setItems((current) => current.filter((entry) => entry.id !== item.id))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Store</h1>
          <p className="mt-1 text-[13px] text-white/40">What players can spend their points on.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/store/redemptions"
            className="inline-flex h-9 items-center rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            Redemptions
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.10] px-3.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/admin/store/add"
            className="inline-flex h-9 items-center gap-2 rounded-md px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-black transition"
            style={{ backgroundColor: ACCENTS.blue }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add item
          </Link>
        </div>
      </header>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Items" value={totals.items.toLocaleString()} />
        <StatTile label="Live in the store" value={totals.live.toLocaleString()} accent="green" />
        <StatTile label="Out of stock" value={totals.out.toLocaleString()} accent="amber" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, category…"
              className="h-9 w-full rounded-md border border-white/10 bg-black/40 pl-9 pr-3 text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/25"
            />
          </div>
          <MonoLabel className="text-white/25">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </MonoLabel>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <MonoLabel className="text-white/25">Loading</MonoLabel>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16">
            <Package className="h-7 w-7 text-white/10" />
            <p className="text-[13px] text-white/30">
              {items.length === 0 ? "Nothing in the store yet." : "Nothing matches that search."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {rows.map((item) => {
              const live = isAvailable(item)
              const stocked = inStock(item)
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                  {item.icon ? (
                    <img
                      src={item.icon}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md border border-white/[0.08] object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02]">
                      <Package className="h-4 w-4 text-white/15" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{item.name}</p>
                    <p className="truncate text-[11px] text-white/30">
                      {[item.category, item.description].filter(Boolean).join(" · ") || "No description"}
                    </p>
                  </div>

                  <Tag accent={isUnlimited(item.quantity) ? "blue" : stocked ? "green" : "red"}>
                    {stockLabel(Number(item.quantity))}
                  </Tag>

                  <span
                    className="w-24 shrink-0 text-right text-[13px] tabular-nums"
                    style={{ color: ACCENTS.blue }}
                  >
                    {(Number(item.cost) || 0).toLocaleString()} pts
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleAvailable(item)}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] uppercase tracking-[0.1em] transition"
                    style={
                      live
                        ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                        : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.35)" }
                    }
                  >
                    {live ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {live ? "Live" : "Hidden"}
                  </button>

                  <Link
                    href={`/admin/store/edit/${item.id}`}
                    aria-label={`Edit ${item.name}`}
                    className="shrink-0 rounded p-1.5 text-white/25 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label={`Delete ${item.name}`}
                    className="shrink-0 rounded p-1.5 text-white/20 transition hover:bg-white/[0.06] hover:text-[#E5484D]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
