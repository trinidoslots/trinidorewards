import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { serviceClient } from "@/lib/supabase/service"
import {
  clampWindowMinutes,
  recorderState,
  splitByAccount,
  type AccountRow,
  type ActivityRow,
} from "@/lib/points-activity"

/**
 * Who is in the window right now, split by whether they have an account.
 *
 * Only ever a preview for the panel. The grant recomputes the window itself —
 * see ../grant — so nothing here decides who gets paid.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const windowMinutes = clampWindowMinutes(searchParams.get("window"))

  const client = serviceClient()
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  const { data: activity, error } = await client
    .from("chat_activity")
    .select("kick_id, username, last_message_at, message_count")
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })

  if (error) {
    console.error("[points] Could not read chat activity:", error)
    return NextResponse.json({ error: "Could not read chat activity" }, { status: 500 })
  }

  const rows = (activity ?? []) as ActivityRow[]

  // Separately from the window: the newest row overall is what says whether
  // anything is recording at all. An empty window and a dead recorder look
  // identical otherwise, and that is exactly the confusion to avoid.
  const { data: newest } = await client
    .from("chat_activity")
    .select("last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Only the accounts that could possibly match are fetched, rather than the
  // whole user table.
  const kickIds = rows.map((row) => row.kick_id)
  const { data: accounts } = kickIds.length
    ? await client.from("users").select("id, kick_id, username, points_balance").in("kick_id", kickIds)
    : { data: [] as AccountRow[] }

  const split = splitByAccount(rows, (accounts ?? []) as AccountRow[])

  return NextResponse.json({
    windowMinutes,
    recorder: {
      state: recorderState(newest?.last_message_at ?? null, Date.now()),
      lastMessageAt: newest?.last_message_at ?? null,
      // Says plainly whether the OBS source can record at all, so a missing
      // env var surfaces in the panel instead of as an empty grant.
      tokenConfigured: Boolean(process.env.RECORDER_TOKEN),
    },
    active: rows.length,
    withAccount: split.withAccount,
    withoutAccount: split.withoutAccount,
  })
}
