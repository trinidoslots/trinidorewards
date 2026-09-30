import { ExternalLink } from "lucide-react"
import { stakeBetUrl } from "@/lib/challenges"

/**
 * The submitted casino ID, linking to the bet on Stake. Hovering shows the
 * full link above it, so it is clear where a click goes before it happens.
 */
export function BetLink({ betId }: { betId: string }) {
  const url = stakeBetUrl(betId)
  return (
    <div className="group relative">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-black/30 px-2.5 py-1.5 font-mono text-[12px] text-white/75 transition hover:border-[#5B8DEF]/60 hover:text-white"
      >
        casino:{betId}
        <ExternalLink className="h-3 w-3 text-white/35 transition group-hover:text-[#5B8DEF]" />
      </a>
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-max max-w-[min(420px,80vw)] translate-y-1 rounded-md border border-white/[0.12] bg-[#121216] px-2.5 py-1.5 font-mono text-[11px] text-white/70 opacity-0 shadow-xl shadow-black/60 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100"
      >
        <span className="break-all">{url}</span>
      </div>
    </div>
  )
}
