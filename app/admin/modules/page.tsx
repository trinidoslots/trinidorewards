"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Blocks, Plus, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile, Tag } from "@/components/ui/panel"
import {
  MODULE_KEYS,
  MODULE_LINKS,
  NAV_CATEGORIES,
  moduleKey,
  readCategory,
  type ModuleKey,
} from "@/lib/site-modules"

/**
 * Which features the site shows.
 *
 * Each row also states the navigation entry it actually controls, and says so
 * when it controls nothing — that is the failure this page could not show
 * before. The seed row is named 'tournament' while the nav looks for
 * 'tournaments', so the toggle appeared to work and changed nothing.
 */

type Module = {
  id: string
  module_name: string
  display_name: string
  description: string | null
  category: string
  is_enabled: boolean
}

export default function AdminModulesPage() {
  const supabaseRef = useRef(createClient())

  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: problem } = await supabaseRef.current
      .from("modules")
      .select("id, module_name, display_name, description, category, is_enabled")
      .order("category")
      .order("module_name")

    if (problem) {
      console.error("[v0] Error loading modules:", problem)
      setError(problem.message || "Could not load modules")
    } else {
      setModules((data ?? []) as Module[])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // The nav's own groups, and only those. The list here used to be its own
  // invention — "main", "bonus_hunt", "seasonal" — none of which the nav had
  // ever heard of, while the nav's "Stream" was not offered at all. Picking one
  // wrote a value that nothing read.
  const categories = NAV_CATEGORIES

  // Grouped here exactly as the nav groups them, so this page is a preview of
  // the nav rather than a second opinion about it. A legacy value shows under
  // the default it actually resolves to.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Module[]>()
    for (const item of modules) {
      const key = moduleKey(item.module_name)
      const category = key ? readCategory(key, item.category) : "hidden"
      const label = NAV_CATEGORIES.find((entry) => entry.id === category)?.label ?? "Hidden"
      byCategory.set(label, [...(byCategory.get(label) ?? []), item])
    }
    const order: string[] = NAV_CATEGORIES.map((entry) => entry.label)
    return Array.from(byCategory.entries()).sort(
      ([a], [b]) => order.indexOf(a) - order.indexOf(b),
    )
  }, [modules])

  // Nav entries with no row at all: switchable only once one exists.
  const missing = useMemo(() => {
    const covered = new Set(modules.map((item) => moduleKey(item.module_name)).filter(Boolean))
    return MODULE_KEYS.filter((key) => !covered.has(key))
  }, [modules])

  const orphans = modules.filter((item) => !moduleKey(item.module_name))

  async function patch(item: Module, changes: Partial<Module>) {
    setBusy(item.id)
    const { error: problem } = await supabaseRef.current
      .from("modules")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", item.id)
    setBusy(null)

    if (problem) {
      setError(problem.message || "Could not update that module")
      return
    }
    setModules((current) => current.map((entry) => (entry.id === item.id ? { ...entry, ...changes } : entry)))
    setError(null)
  }

  async function create(key: ModuleKey) {
    setBusy(key)
    const { data, error: problem } = await supabaseRef.current
      .from("modules")
      .insert({
        module_name: key,
        display_name: MODULE_LINKS[key].label,
        description: `Shows ${MODULE_LINKS[key].href} in the navigation`,
        category: "main",
        // Created off: adding a row should not put a link on the site that
        // nobody asked for.
        is_enabled: false,
      })
      .select("id, module_name, display_name, description, category, is_enabled")
      .single()
    setBusy(null)

    if (problem || !data) {
      setError(problem?.message || "Could not create that module")
      return
    }
    setModules((current) => [...current, data as Module])
    setError(null)
  }

  const enabled = modules.filter((item) => item.is_enabled).length

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Modules</h1>
          <p className="mt-1 text-[13px] text-white/40">What the site shows, and what each switch controls.</p>
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

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Modules" value={modules.length.toLocaleString()} />
        <StatTile label="Enabled" value={enabled.toLocaleString()} accent="green" />
        <StatTile
          label="Not wired to a link"
          value={(orphans.length + missing.length).toLocaleString()}
          accent={orphans.length + missing.length > 0 ? "amber" : "slate"}
        />
      </div>

      {missing.length > 0 && (
        <Panel accent="amber">
          <PanelHeader title="Navigation entries with no module" accent="amber" />
          <p className="px-3.5 pt-2.5 text-[12.5px] text-white/35">
            These links have no row, so there is nothing to switch them on with. Creating one adds the switch — it
            starts off.
          </p>
          <ul className="mt-2 divide-y divide-white/[0.05]">
            {missing.map((key) => (
              <li key={key} className="flex items-center gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white">{MODULE_LINKS[key].label}</p>
                  <MonoLabel className="text-white/25">{MODULE_LINKS[key].href}</MonoLabel>
                </div>
                <button
                  type="button"
                  onClick={() => create(key)}
                  disabled={busy === key}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/[0.10] px-3 font-mono text-[10px] uppercase tracking-[0.1em] text-white/50 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                >
                  <Plus className="h-3 w-3" />
                  Create
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {loading ? (
        <Panel className="py-16 text-center">
          <MonoLabel className="text-white/25">Loading</MonoLabel>
        </Panel>
      ) : modules.length === 0 ? (
        <Panel className="flex flex-col items-center gap-2 py-16">
          <Blocks className="h-7 w-7 text-white/10" />
          <p className="text-[13px] text-white/30">No modules configured.</p>
        </Panel>
      ) : (
        grouped.map(([category, items]) => (
          <Panel key={category} accent="blue">
            <PanelHeader
              title={category}
              right={<MonoLabel className="text-white/25">{items.length}</MonoLabel>}
            />
            <ul className="divide-y divide-white/[0.05]">
              {items.map((item) => {
                const key = moduleKey(item.module_name)
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-medium text-white">{item.display_name}</span>
                        <MonoLabel className="text-white/20">{item.module_name}</MonoLabel>
                      </div>
                      {item.description && (
                        <p className="truncate text-[11px] text-white/30">{item.description}</p>
                      )}
                      <div className="mt-1">
                        {key ? (
                          <MonoLabel style={{ color: ACCENTS.blue }}>Controls {MODULE_LINKS[key].href}</MonoLabel>
                        ) : (
                          // The exact failure that hid Tournaments: a switch
                          // wired to nothing looks like it works.
                          <span className="inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3" style={{ color: ACCENTS.amber }} />
                            <MonoLabel style={{ color: ACCENTS.amber }}>Controls no link</MonoLabel>
                          </span>
                        )}
                      </div>
                    </div>

                    <label className="shrink-0">
                      <MonoLabel className="mb-1 block text-white/25">Category</MonoLabel>
                      <select
                        value={
                          moduleKey(item.module_name)
                            ? readCategory(moduleKey(item.module_name)!, item.category)
                            : "hidden"
                        }
                        onChange={(event) => patch(item, { category: event.target.value })}
                        disabled={busy === item.id}
                        className="h-8 rounded-md border border-white/[0.10] bg-black/40 px-2.5 text-[12.5px] text-white outline-none transition focus:border-white/25 disabled:opacity-40"
                      >
                        {categories.map((option) => (
                          <option key={option.id} value={option.id} className="bg-[#121216]">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => patch(item, { is_enabled: !item.is_enabled })}
                      disabled={busy === item.id}
                      className="inline-flex h-8 shrink-0 items-center rounded-md border px-3 font-mono text-[10px] uppercase tracking-[0.1em] transition disabled:opacity-40"
                      style={
                        item.is_enabled
                          ? { borderColor: `${ACCENTS.green}55`, color: ACCENTS.green }
                          : { borderColor: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.35)" }
                      }
                    >
                      {item.is_enabled ? "Enabled" : "Disabled"}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        ))
      )}
    </div>
  )
}
