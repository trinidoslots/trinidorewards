import type { Metadata } from "next"
import { BrandMark } from "@/components/brand-mark"
import { ACCENTS, MonoLabel } from "@/components/ui/panel"
import { MaintenanceWatch } from "./watch"

export const metadata: Metadata = {
  title: "Maintenance",
  robots: { index: false },
}

const KICK_URL = "https://kick.com/trinidoslots"

/**
 * Where every public page goes while the maintenance module is on.
 *
 * The middleware sends people here and, once maintenance is off, sends
 * anyone who still opens this address back to the home page (lib/site-gate.ts).
 * An open tab notices by itself: MaintenanceWatch checks every half minute.
 */
export default function MaintenancePage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B0B0D] p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.08] blur-[90px]"
        style={{ background: ACCENTS.blue }}
      />

      <main className="relative flex w-full max-w-md flex-col items-center text-center">
        <BrandMark className="h-14 w-14" />

        <span className="mt-8 inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: ACCENTS.amber }} />
          <MonoLabel style={{ color: ACCENTS.amber }}>Maintenance</MonoLabel>
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">We&apos;ll be right back</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/45">
          TrinidoRewards is getting some work done. This page takes you back to the site by itself as soon as
          it is up again.
        </p>

        <a
          href={KICK_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-8 inline-flex h-10 items-center gap-2 rounded-md border border-white/[0.10] px-4 font-mono text-[11px] uppercase tracking-[0.1em] text-white/60 transition hover:border-white/25 hover:text-white"
        >
          Watch on Kick
        </a>
      </main>

      <MaintenanceWatch />
    </div>
  )
}
