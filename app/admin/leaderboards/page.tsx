import { redirect } from "next/navigation"

/**
 * This route held a second, older leaderboard admin — 1,000 lines of the
 * pre-board design with its own CSV parser, its own payout ladder and its own
 * copy of the entry table. Nothing linked to it: the sidebar points at
 * /overview and /manage, which supersede it.
 *
 * It went rather than being carried through the wagered/earned rename. Dead
 * code that still writes to a renamed column is worse than dead code — it
 * looks like it works until someone opens it.
 */
export default function LeaderboardsIndex() {
  redirect("/admin/leaderboards/overview")
}
