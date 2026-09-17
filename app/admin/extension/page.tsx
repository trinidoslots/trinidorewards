"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Chrome, Download, FolderOpen, Key, Puzzle, ShieldCheck, Terminal } from "lucide-react"

const steps = [
  {
    title: "Download the extension",
    description: 'Click "Download extension" below to get a .zip of the unpacked Chrome extension files.',
  },
  {
    title: "Unzip the folder",
    description: "Extract the .zip anywhere on your computer — you'll load this unpacked folder into Chrome.",
  },
  {
    title: "Open Chrome extensions",
    description: 'Go to chrome://extensions in your browser and enable "Developer mode" in the top-right corner.',
  },
  {
    title: "Load unpacked",
    description: 'Click "Load unpacked" and select the unzipped extension folder.',
  },
  {
    title: "Add your API key",
    description: "Click the extension icon, paste your EXTENSION_API_KEY, and save. This authorizes bonus submissions.",
  },
]

export default function AdminExtensionPage() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/extension/download")
      if (!response.ok) throw new Error("Could not build the extension package")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "bonushunt-tracker-extension.zip"
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the extension")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white/90 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#5B8DEF]">
              <Puzzle className="h-4 w-4" /> Chrome extension
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Hunt Tracker Extension</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
              Add bonuses to the active hunt directly from Stake&apos;s game page. The extension injects an &quot;+ Add
              Bonus&quot; button next to the game info row and posts straight into your active hunt.
            </p>
          </div>
          <Button onClick={handleDownload} disabled={downloading} className="bg-[#5B8DEF] text-[#0B0B0D] hover:bg-[#7FA8F5]">
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Preparing..." : "Download extension"}
          </Button>
        </header>

        {error && (
          <div className="rounded-lg border border-rose-800 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <section className="rounded-2xl border border-[#5B8DEF]/20 bg-[#5B8DEF]/[0.04] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5B8DEF]">
            <FolderOpen className="h-4 w-4" /> Source location
          </div>
          <p className="mt-2 text-sm leading-6 text-white/60">
            The extension source lives in the project at{" "}
            <code className="rounded bg-[#101014] px-1.5 py-0.5 font-mono text-[#7FA8F5]">/extension</code>. Use the
            download button above to get it as a ready-to-load .zip — no need to dig through the codebase.
          </p>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/30">
            <Chrome className="h-4 w-4" /> Installation
          </div>
          <h2 className="mt-1 text-xl font-bold text-white">Load it into Chrome</h2>
          <ol className="mt-5 space-y-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-xl border border-white/[0.06] bg-black/30 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B8DEF]/10 text-sm font-bold text-[#5B8DEF]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/40">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.022] p-4">
            <div className="flex items-center gap-2 text-white/40">
              <Key className="h-4 w-4 text-amber-300" />
              <span className="text-xs uppercase tracking-wider">API key</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">
              The extension authenticates with your{" "}
              <code className="rounded bg-[#0B0B0D] px-1.5 py-0.5 font-mono text-amber-200">EXTENSION_API_KEY</code>{" "}
              environment variable. Open the extension popup to paste it in — it&apos;s stored locally in Chrome and sent
              as a Bearer token on every request.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.022] p-4">
            <div className="flex items-center gap-2 text-white/40">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              <span className="text-xs uppercase tracking-wider">How it works</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/60">
              On Stake game pages, click &quot;+ Add Bonus&quot;, enter the bet size, and it posts the game name and bet
              size straight to whichever hunt is currently active on your site.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.06] bg-white/[0.022] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/30">
            <Terminal className="h-4 w-4" /> API reference
          </div>
          <p className="mt-2 text-sm leading-6 text-white/40">
            The extension talks to{" "}
            <code className="rounded bg-[#0B0B0D] px-1.5 py-0.5 font-mono text-[#7FA8F5]">
              /api/extension/add-bonus
            </code>
            . Every request needs an{" "}
            <code className="rounded bg-[#0B0B0D] px-1.5 py-0.5 font-mono text-[#7FA8F5]">Authorization: Bearer &lt;EXTENSION_API_KEY&gt;</code>{" "}
            header. GET returns the active hunt, POST adds a bonus, and DELETE removes one by id.
          </p>
        </section>
      </div>
    </main>
  )
}
