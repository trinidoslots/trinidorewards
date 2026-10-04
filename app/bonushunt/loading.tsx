import { PageIntro } from "@/components/ui/shell-kit"

/**
 * Shown the moment the page is clicked, while the server reads the hunt.
 *
 * Without this, a click on Bonus Hunts did nothing visible until every query
 * had come back — the nav highlighted and the old page sat there — which read
 * as the site hanging. The intro is the real one, so when the page arrives
 * only the body changes.
 */
export default function Loading() {
  return (
    <div>
      <PageIntro
        label="Bonus hunt"
        title="The bonus hunt."
        muted="Every bonus, as it opens."
        description="Every bonus as it is collected, the running numbers, and how far the remaining spins have to carry it."
      />
      {/* The body's box, opted out of the scroll reveal: the real body rises in
          when it replaces this, and the placeholder rising first made two. */}
      <div data-no-reveal className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="mb-6 h-11 w-64 animate-pulse rounded-full border border-white/[0.06] bg-white/[0.025]" />
        {/* The board's own shape: scoreboard, the figures, the records, the list. */}
        <div className="space-y-4">
          <div className="h-[340px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-[88px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-[170px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
            <div className="h-[170px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />
          </div>
          <div className="h-[420px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      </div>
    </div>
  )
}
