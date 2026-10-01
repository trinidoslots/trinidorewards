import { PageHero } from "@/components/page-hero"

/**
 * Shown the moment the page is clicked, while the server reads the hunt.
 *
 * Without this, a click on Bonus Hunts did nothing visible until every query
 * had come back — the nav highlighted and the old page sat there — which read
 * as the site hanging. The header is the real one, so when the page arrives
 * only the body changes.
 */
export default function Loading() {
  return (
    <div>
      <PageHero
        accent="amber"
        title="Bonus hunt"
        subtitle="Every bonus as it is collected, the running numbers, and how far the remaining spins have to carry it."
        note="Loading"
      />
      {/* PageBody's box, opted out of the scroll reveal: the real body rises in
          when it replaces this, and the placeholder rising first made two. */}
      <div data-no-reveal className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-5 flex gap-6 border-b border-white/[0.08] pb-2.5">
          <div className="h-4 w-24 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-28 animate-pulse rounded bg-white/[0.04]" />
        </div>
        {/* The board's own shape: scoreboard, the two records, the list. */}
        <div className="space-y-4">
          <div className="h-[260px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-[118px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
            <div className="h-[118px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.025]" />
          </div>
          <div className="h-[420px] animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      </div>
    </div>
  )
}
