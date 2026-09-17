"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Radio, Database, Globe, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react"

type HuntSource = "integrated" | "external"

type ExternalHunt = {
  id: string
  title: string
  casino: string
  startCost: number
  isOpening: boolean
  stats?: {
    bonusCount?: number
    totalWinnings?: number
    profitLoss?: number
  }
}

const ENDPOINTS = [
  { method: "GET", path: "/api/public/hunts", label: "List All Hunts" },
  { method: "GET", path: "/api/public/hunts/{id}", label: "Get Hunt by ID" },
  { method: "GET", path: "/api/public/stats", label: "Get User Statistics" },
  { method: "POST", path: "/api/public/slot-request", label: "Submit Slot Request" },
  { method: "POST", path: "/api/public/guess-the-balance", label: "Submit Balance Guess" },
  { method: "GET", path: "/api/public/hunts/{id}/guess-the-balance", label: "Get Guess The Balance Status" },
]

export default function HuntSourcePage() {
  const supabase = createClient()
  const [source, setSource] = useState<HuntSource>("integrated")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [connectionStatus, setConnectionStatus] = useState<"idle" | "checking" | "ok" | "error">("idle")
  const [connectionError, setConnectionError] = useState("")
  const [hunts, setHunts] = useState<ExternalHunt[]>([])
  const [loadingHunts, setLoadingHunts] = useState(false)

  // Load the current source setting
  useEffect(() => {
    const fetchSource = async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "hunt_source").maybeSingle()
      if (data?.value === "external" || data?.value === "integrated") {
        setSource(data.value)
      }
      setLoading(false)
    }
    fetchSource()
  }, [supabase])

  const testConnection = async () => {
    setConnectionStatus("checking")
    setConnectionError("")
    setLoadingHunts(true)
    try {
      const res = await fetch("/api/external/hunts?limit=100")
      const data = await res.json()
      if (!res.ok) {
        setConnectionStatus("error")
        setConnectionError(data.error || "Connection failed")
        setHunts([])
      } else {
        setConnectionStatus("ok")
        setHunts(data.hunts || [])
      }
    } catch (error) {
      setConnectionStatus("error")
      setConnectionError(error instanceof Error ? error.message : "Connection failed")
    } finally {
      setLoadingHunts(false)
    }
  }

  // Auto-test the connection once on load
  useEffect(() => {
    testConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveSource = async (newSource: HuntSource) => {
    setSaving(true)
    setSource(newSource)
    try {
      const { data: existing } = await supabase
        .from("settings")
        .select("*")
        .eq("key", "hunt_source")
        .maybeSingle()

      if (existing) {
        await supabase
          .from("settings")
          .update({ value: newSource, updated_at: new Date().toISOString() })
          .eq("key", "hunt_source")
      } else {
        await supabase.from("settings").insert([{ key: "hunt_source", value: newSource }])
      }
    } catch (error) {
      console.error("[v0] Error saving hunt source:", error)
    } finally {
      setSaving(false)
    }
  }

  const openingHunt = hunts.find((h) => h.isOpening) || hunts[0] || null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-cyan-600/20 border border-cyan-600/30 rounded-xl p-3">
          <Radio className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-white text-3xl font-bold">Hunt Source</h1>
          <p className="text-slate-400">Choose where the public bonus hunt page pulls its data from.</p>
        </div>
      </div>

      {/* Source selector */}
      <div className="grid gap-4 md:grid-cols-2">
        <button
          onClick={() => saveSource("integrated")}
          disabled={saving}
          className={`text-left rounded-2xl border p-6 transition-all ${
            source === "integrated"
              ? "bg-cyan-600/15 border-cyan-500/50 ring-1 ring-cyan-500/40"
              : "bg-white/5 border-slate-700/50 hover:bg-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <Database className={`w-6 h-6 ${source === "integrated" ? "text-cyan-400" : "text-slate-400"}`} />
            {source === "integrated" && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
          </div>
          <h3 className="text-white font-bold text-lg mb-1">Integrated Hunts</h3>
          <p className="text-slate-400 text-sm">Use hunts managed inside this dashboard (local database).</p>
        </button>

        <button
          onClick={() => saveSource("external")}
          disabled={saving}
          className={`text-left rounded-2xl border p-6 transition-all ${
            source === "external"
              ? "bg-cyan-600/15 border-cyan-500/50 ring-1 ring-cyan-500/40"
              : "bg-white/5 border-slate-700/50 hover:bg-white/10"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <Globe className={`w-6 h-6 ${source === "external" ? "text-cyan-400" : "text-slate-400"}`} />
            {source === "external" && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
          </div>
          <h3 className="text-white font-bold text-lg mb-1">bonushunt.gg API</h3>
          <p className="text-slate-400 text-sm">Pull the latest opening hunt directly from bonushunt.gg.</p>
        </button>
      </div>

      {/* Connection status */}
      <div className="bg-white/5 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-xl font-bold">API Connection</h2>
          <Button
            onClick={testConnection}
            disabled={connectionStatus === "checking"}
            className="bg-slate-700/50 hover:bg-slate-600 text-white gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${connectionStatus === "checking" ? "animate-spin" : ""}`} />
            Test Connection
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {connectionStatus === "ok" && (
            <>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">Connected to bonushunt.gg</span>
            </>
          )}
          {connectionStatus === "error" && (
            <>
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 font-medium">{connectionError}</span>
            </>
          )}
          {connectionStatus === "checking" && (
            <>
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-slate-400 font-medium">Checking connection...</span>
            </>
          )}
        </div>

        <p className="text-slate-500 text-sm">Rate limits: 100 requests/minute, 1000 requests/hour.</p>
      </div>

      {/* Currently displayed hunt (external) */}
      {source === "external" && (
        <div className="bg-white/5 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white text-xl font-bold mb-4">Currently Displayed Hunt</h2>
          {loadingHunts ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading hunts...
            </div>
          ) : openingHunt ? (
            <div className="bg-slate-800/50 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-lg">{openingHunt.title}</p>
                    {openingHunt.isOpening && (
                      <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">Opening</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">
                    {openingHunt.casino} · Start ${Number(openingHunt.startCost).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-cyan-400 font-bold">{openingHunt.stats?.bonusCount ?? 0} bonuses</p>
                  <p className="text-slate-400 text-sm">ID: {openingHunt.id}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No hunts found on bonushunt.gg.</p>
          )}
        </div>
      )}

      {/* All external hunts */}
      {source === "external" && hunts.length > 0 && (
        <div className="bg-white/5 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-white text-xl font-bold mb-4">All Hunts ({hunts.length})</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {hunts.map((h) => (
              <div key={h.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{h.title}</span>
                  {h.isOpening && (
                    <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">Opening</span>
                  )}
                </div>
                <span className="text-slate-400 text-sm">{h.casino}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Endpoints reference */}
      <div className="bg-white/5 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-white text-xl font-bold mb-4">Available Endpoints</h2>
        <div className="space-y-2">
          {ENDPOINTS.map((ep) => (
            <div key={ep.path} className="flex items-center gap-3 bg-slate-800/40 rounded-lg p-3">
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  ep.method === "GET" ? "bg-blue-600/20 text-blue-400" : "bg-green-600/20 text-green-400"
                }`}
              >
                {ep.method}
              </span>
              <code className="text-slate-300 text-sm">{ep.path}</code>
              <span className="text-slate-500 text-sm ml-auto">{ep.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
