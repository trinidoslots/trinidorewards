"use client"

import { useCallback, useEffect, useState } from "react"
import { Dices, Gamepad2, Loader2, Tv } from "lucide-react"
import { ACCENTS, MonoLabel, Panel, PanelHeader, StatTile } from "@/components/ui/panel"
import { SelectMenu } from "@/components/ui/select-menu"
import { RandomSlotCard, type RandomSpin } from "@/components/obs/random-slot-spinner"

/**
 * The random slot: spin, and the stream column shows the reel.
 *
 * The pick is made on the server (/api/admin/random-slot) from the whole slot
 * catalogue — the full Stake list once it has been imported on Edit Slots —
 * and written as a spin that /obs/stream and /random-slot animate. The preview
 * on the right is the same card, so what is seen here is what the stream sees.
 *
 * This page used to spin in the browser only: the result was never written
 * anywhere, and the OBS widget kept showing "Ready".
 */

type Provider = { name: string; count: number }
type Overview = { total: number; providers: Provider[]; spins: RandomSpin[] }

const ALL = "__all__"

export default function RandomSlotPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [spin, setSpin] = useState<RandomSpin | null>(null)
  const [provider, setProvider] = useState(ALL)
  const [withImage, setWithImage] = useState(false)
  const [onlyOnStake, setOnlyOnStake] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/random-slot", { cache: "no-store" })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) {
      setError(json?.error ?? "Could not load the slot catalogue.")
      return
    }
    setOverview(json)
    setSpin((current) => current ?? json.spins?.[0] ?? null)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Ticks while a spin is running, to know when the button is free again.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const spinning = spin ? now < Date.parse(spin.started_at) + (Number(spin.spin_ms) || 6000) : false

  async function doSpin() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/admin/random-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: provider === ALL ? undefined : provider, withImage, onlyOnStake }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(json.error ?? "The spin failed.")
      return
    }
    setSpin(json.spin)
    setNow(Date.now())
    setOverview((current) => (current ? { ...current, spins: [json.spin, ...current.spins].slice(0, 10) } : current))
  }

  const providerCount = provider === ALL ? overview?.total : overview?.providers.find((entry) => entry.name === provider)?.count

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-white">Random slot</h1>
        <p className="mt-1 text-[13px] text-white/40">
          Spin, and the reel runs on stream in the event column. Picks from the whole slot catalogue.
        </p>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-3">
        <StatTile label="Slots to pick from" value={overview ? overview.total.toLocaleString() : "—"} accent="blue" />
        <StatTile label="Providers" value={overview ? overview.providers.length.toLocaleString() : "—"} />
        <StatTile
          label="Last pick"
          value={overview?.spins[0] ? (overview.spins[0].provider ?? "—") : "—"}
          accent="amber"
          hint={overview?.spins[0]?.slot_name}
        />
      </div>

      {error && (
        <Panel accent="red" className="px-3.5 py-2.5 text-[13px]" style={{ color: ACCENTS.red }}>
          {error}
        </Panel>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <Panel accent="amber">
          <PanelHeader title="Spin" accent="amber" />
          <div className="space-y-4 p-4">
            <label className="block">
              <MonoLabel className="mb-1.5 block text-white/35">Provider</MonoLabel>
              <SelectMenu
                aria-label="Provider"
                value={provider}
                onChange={setProvider}
                options={[
                  { value: ALL, label: "All providers", hint: overview ? `${overview.total.toLocaleString()} slots` : undefined },
                  ...(overview?.providers ?? []).map((entry) => ({
                    value: entry.name,
                    label: entry.name,
                    hint: `${entry.count.toLocaleString()} slots`,
                  })),
                ]}
              />
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60">
              <input
                type="checkbox"
                checked={withImage}
                onChange={(e) => setWithImage(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#E8A33D]"
              />
              Only slots with artwork
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-white/60">
              <input
                type="checkbox"
                checked={onlyOnStake}
                onChange={(e) => setOnlyOnStake(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#E8A33D]"
              />
              Only on Stake <span className="text-white/30">– the exclusives only</span>
            </label>

            <button
              type="button"
              onClick={doSpin}
              disabled={busy || spinning || !overview?.total}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-lg text-[16px] font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "#FF8A4C" }}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Dices className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`} />}
              {spinning ? "Spinning…" : "Spin"}
            </button>
            <p className="flex items-center gap-1.5 text-[12px] text-white/35">
              <Tv className="h-3.5 w-3.5" />
              {providerCount !== undefined && !withImage && !onlyOnStake
                ? `${providerCount.toLocaleString()} slots in the draw. `
                : ""}
              Shown in <span className="font-mono text-white/55">/obs/stream</span> and{" "}
              <span className="font-mono text-white/55">/random-slot</span>.
            </p>
          </div>
        </Panel>

        <div className="space-y-2">
          <MonoLabel className="block text-white/30">What the stream sees</MonoLabel>
          <div className="rounded-xl bg-[#0E0E12] p-2">
            {spin ? (
              <RandomSlotCard key={spin.id} spin={spin} />
            ) : (
              <p className="py-10 text-center text-[13px] text-white/30">No spin yet.</p>
            )}
          </div>
        </div>
      </div>

      <Panel>
        <PanelHeader title="Recent spins" accent="slate" />
        {!overview?.spins.length ? (
          <p className="py-10 text-center text-[13px] text-white/30">Nothing spun yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {overview.spins.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.03]">
                  {entry.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external slot artwork
                    <img src={entry.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-4 w-4 text-white/15" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-white">{entry.slot_name}</p>
                  <p className="truncate text-[11px] text-white/30">{entry.provider ?? "—"}</p>
                </div>
                <MonoLabel className="shrink-0 text-white/25">
                  {new Date(entry.started_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </MonoLabel>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
