"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Database, Globe, Loader2, RefreshCw, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ACCENTS, MonoLabel, Panel, PanelHeader, Tag } from "@/components/ui/panel"

/**
 * Where the public bonus hunt page gets its hunt from: the hunts run in this
 * panel, or bonushunt.gg. Stored as settings.hunt_source.
 */

type HuntSource = "integrated" | "external"

type ExternalHunt = {
  id: string
  title: string
  casino: string
  startCost: number
  isOpening: boolean
  stats?: { bonusCount?: number; totalWinnings?: number; profitLoss?: number }
}

const ENDPOINTS = [
  { method: "GET", path: "/api/public/hunts", label: "List all hunts" },
  { method: "GET", path: "/api/public/hunts/{id}", label: "Get a hunt by id" },
  { method: "GET", path: "/api/public/stats", label: "User statistics" },
  { method: "POST", path: "/api/public/slot-request", label: "Submit a slot request" },
  { method: "POST", path: "/api/public/guess-the-balance", label: "Submit a balance guess" },
  { method: "GET", path: "/api/public/hunts/{id}/guess-the-balance", label: "Guess-the-balance status" },
]

function SourceCard({
  active,
  disabled,
  onClick,
  icon: Icon,
  title,
  text,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  icon: typeof Database
  title: string
  text: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border p-4 text-left transition disabled:cursor-wait"
      style={
        active
          ? { borderColor: `${ACCENTS.blue}77`, backgroundColor: `${ACCENTS.blue}14` }
          : { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.022)" }
      }
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: active ? `${ACCENTS.blue}22` : "rgba(255,255,255,0.04)" }}
        >
          <Icon className="h-4 w-4" style={{ color: active ? ACCENTS.blue : "rgba(255,255,255,0.4)" }} />
        </span>
        {active && <Tag accent="blue">In use</Tag>}
      </div>
      <p className="mt-3 text-[14px] font-semibold text-white">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-white/40">{text}</p>
    </button>
  )
}

export default function HuntSourcePage() {
  const [supabase] = useState(() => createClient())
  const [source, setSource] = useState<HuntSource>("integrated")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle")
  const [statusError, setStatusError] = useState("")
  const [hunts, setHunts] = useState<ExternalHunt[]>([])

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "hunt_source")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value === "external" || data?.value === "integrated") setSource(data.value)
        setLoading(false)
      })
  }, [supabase])

  const testConnection = useCallback(async () => {
    setStatus("checking")
    setStatusError("")
    try {
      const res = await fetch("/api/external/hunts?limit=100")
      const data = await res.json()
      if (!res.ok) {
        setStatus("error")
        setStatusError(data.error || "Connection failed")
        setHunts([])
      } else {
        setStatus("ok")
        setHunts(data.hunts || [])
      }
    } catch (error) {
      setStatus("error")
      setStatusError(error instanceof Error ? error.message : "Connection failed")
    }
  }, [])

  // Checked once on load, so the page says straight away whether the key works.
  useEffect(() => {
    testConnection()
  }, [testConnection])

  async function saveSource(next: HuntSource) {
    if (next === source) return
    setSaving(true)
    const previous = source
    setSource(next)
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "hunt_source", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" })
    if (error) {
      console.error("[v0] Error saving hunt source:", error)
      setSource(previous)
    }
    setSaving(false)
  }

  const opening = hunts.find((hunt) => hunt.isOpening) || hunts[0] || null

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Hunt source</h1>
        <p className="mt-1 text-[13px] text-white/40">Where the public bonus hunt page gets its hunt from.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <SourceCard
          active={source === "integrated"}
          disabled={saving}
          onClick={() => saveSource("integrated")}
          icon={Database}
          title="This panel"
          text="The hunt you run under Hunt → Bonushunt."
        />
        <SourceCard
          active={source === "external"}
          disabled={saving}
          onClick={() => saveSource("external")}
          icon={Globe}
          title="bonushunt.gg"
          text="The latest opening hunt from your bonushunt.gg account."
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel accent={status === "ok" ? "green" : status === "error" ? "red" : "slate"}>
          <PanelHeader
            title="bonushunt.gg connection"
            accent={status === "ok" ? "green" : status === "error" ? "red" : "slate"}
            right={
              <button
                type="button"
                onClick={testConnection}
                disabled={status === "checking"}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40 transition hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${status === "checking" ? "animate-spin" : ""}`} /> Test
              </button>
            }
          />
          <div className="space-y-3 p-4">
            <p className="flex items-center gap-2 text-[13px]">
              {status === "ok" && (
                <>
                  <CheckCircle2 className="h-4 w-4" style={{ color: ACCENTS.green }} />
                  <span style={{ color: ACCENTS.green }}>Connected – {hunts.length} hunts found</span>
                </>
              )}
              {status === "error" && (
                <>
                  <XCircle className="h-4 w-4" style={{ color: ACCENTS.red }} />
                  <span style={{ color: ACCENTS.red }}>{statusError}</span>
                </>
              )}
              {status === "checking" && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                  <span className="text-white/40">Checking the connection…</span>
                </>
              )}
            </p>
            {opening && (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <MonoLabel className="text-white/30">{source === "external" ? "On the site now" : "Would be shown"}</MonoLabel>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-[14px] font-medium text-white">
                      {opening.title}
                      {opening.isOpening && <Tag accent="green">Opening</Tag>}
                    </p>
                    <p className="text-[12px] text-white/40">
                      {opening.casino} · start ${Number(opening.startCost).toFixed(2)}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold" style={{ color: ACCENTS.blue }}>
                    {opening.stats?.bonusCount ?? 0} bonuses
                  </p>
                </div>
              </div>
            )}
            <p className="text-[11.5px] text-white/25">Rate limits: 100 requests a minute, 1000 an hour.</p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Hunts on bonushunt.gg" accent="slate" right={<MonoLabel className="text-white/25">{hunts.length}</MonoLabel>} />
          {hunts.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-white/30">
              {status === "checking" ? "Loading…" : "No hunts to show."}
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-white/[0.05] overflow-y-auto">
              {hunts.map((hunt) => (
                <li key={hunt.id} className="flex items-center gap-2 px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white">{hunt.title}</span>
                  {hunt.isOpening && <Tag accent="green">Opening</Tag>}
                  <span className="shrink-0 text-[12px] text-white/35">{hunt.casino}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="bonushunt.gg endpoints" accent="slate" />
        <ul className="divide-y divide-white/[0.05]">
          {ENDPOINTS.map((endpoint) => (
            <li key={endpoint.path} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <Tag accent={endpoint.method === "GET" ? "blue" : "green"}>{endpoint.method}</Tag>
              <code className="text-[12px] text-white/60">{endpoint.path}</code>
              <span className="ml-auto text-[12px] text-white/30">{endpoint.label}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
