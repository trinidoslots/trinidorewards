import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { adminTag } from "@/lib/admin-auth"
import { serviceClient } from "@/lib/supabase/service"
import { likeExact } from "@/lib/like"

/**
 * Everything the admin user page shows, in one request.
 *
 * Behind a session check rather than open like some of the older admin routes:
 * this returns payout details, and the middleware only guards /admin *pages* —
 * an API route is reachable directly, so it has to establish for itself that
 * the caller is signed in.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Was "is anyone signed in to Supabase", which a public sign-up satisfied.
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params
  const client = serviceClient()

  // "*" on purpose — no migration ever created this table, so naming a column
  // it may not have (avatar_url, until scripts/047) fails the whole request.
  const { data: user, error } = await client.from("users").select("*").eq("id", id).maybeSingle()

  if (error) {
    console.error("[v0] Could not load user:", error)
    return NextResponse.json({ error: "Could not load that user" }, { status: 500 })
  }
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 })

  const [accounts, payments, redemptions, raffleEntries, wins] = await Promise.all([
    client
      .from("user_site_usernames")
      .select("id, site_name, username, created_at")
      .eq("user_id", id)
      .order("site_name"),
    client
      .from("user_payment_methods")
      .select("id, method, label, value, is_primary, created_at")
      .eq("user_id", id)
      .order("created_at"),
    client
      .from("redemptions")
      .select("id, item_id, item_name, cost, status, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    client
      .from("raffle_entries")
      .select("id, raffle_id, tickets_purchased, points_spent, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    // Matched on the name as well as the id: wins recorded before this account
    // existed were only ever attached to a username, and they are still theirs.
    client
      .from("win_logs")
      .select("id, username, source, source_ref, prize, amount, points, status, created_at")
      .or(`user_id.eq.${id},username.ilike.${likeExact(user.username)}`)
      .order("created_at", { ascending: false }),
  ])

  // Raffle rows carry the points but not the prize, so the titles are fetched
  // in one go rather than per entry.
  const raffleIds = Array.from(new Set((raffleEntries.data ?? []).map((entry) => entry.raffle_id).filter(Boolean)))
  const { data: raffles } = raffleIds.length
    ? await client.from("raffles").select("id, title, prize_name, status").in("id", raffleIds)
    : { data: [] as { id: string; title: string; prize_name: string; status: string }[] }

  const raffleById = new Map((raffles ?? []).map((raffle) => [raffle.id, raffle]))

  for (const result of [accounts, payments, redemptions, raffleEntries, wins]) {
    // A missing optional table should not take the whole page down — the
    // section simply renders empty.
    if (result.error) console.error("[v0] Partial user load:", result.error)
  }

  const redemptionRows = redemptions.data ?? []
  const raffleRows = (raffleEntries.data ?? []).map((entry) => ({
    ...entry,
    raffle: raffleById.get(entry.raffle_id) ?? null,
  }))

  const spentOnStore = redemptionRows
    // A rejected redemption was refunded, so counting it would overstate what
    // the user actually spent.
    .filter((row) => row.status !== "rejected" && row.status !== "cancelled")
    .reduce((sum, row) => sum + (Number(row.cost) || 0), 0)
  const spentOnRaffles = raffleRows.reduce((sum, row) => sum + (Number(row.points_spent) || 0), 0)

  // The staff tag lives on the on-site account and names its Kick account
  // (admin_accounts, scripts/071); Code User is a flag on users (scripts/076).
  const kickId = user.kick_id ? String(user.kick_id) : null
  const tag = await adminTag({ siteUserId: user.id, kickId })
  const rank: Rank = tag ? tag.role : user.is_code_user === true ? "code_user" : "user"
  const admin = {
    is_admin: !!tag,
    rank,
    // Shown so the page can refuse, before the route does, to let you change
    // your own rank.
    is_self: user.id === auth.siteUserId,
    // The main admin's rank cannot be changed by anyone.
    is_owner: tag?.isOwner === true,
  }

  return NextResponse.json({
    user,
    admin,
    accounts: accounts.data ?? [],
    payments: payments.data ?? [],
    redemptions: redemptionRows,
    raffleEntries: raffleRows,
    wins: wins.data ?? [],
    totals: {
      points: Number(user.points_balance) || 0,
      spentOnStore,
      spentOnRaffles,
      spentTotal: spentOnStore + spentOnRaffles,
      redemptions: redemptionRows.length,
      rafflesEntered: raffleRows.length,
      tickets: raffleRows.reduce((sum, row) => sum + (Number(row.tickets_purchased) || 0), 0),
      wins: (wins.data ?? []).length,
      wonCash: (wins.data ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    },
  })
}

type Rank = "user" | "code_user" | "moderator" | "admin"
const RANKS: Rank[] = ["user", "code_user", "moderator", "admin"]

/**
 * Sets this user's rank: User, Code User, Moderator or Admin.
 *
 * Moderator and Admin are a staff tag in admin_accounts (with its role);
 * User and Code User have no tag, and differ by users.is_code_user. One rank
 * at a time, so a staff rank clears the Code User flag.
 *
 * Takes effect on their next request: every staff check looks the tag up
 * afresh (lib/admin-auth.ts). You cannot change your own rank from here, so
 * the panel can never be left without the admin who was using it, and nobody
 * can change the main admin's (scripts/071).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => null)) as { role?: unknown } | null
  const role = body?.role as Rank
  if (!RANKS.includes(role)) {
    return NextResponse.json({ error: `Expected { role: ${RANKS.join(" | ")} }` }, { status: 400 })
  }

  const { id } = await params
  const client = serviceClient()
  // "*" so it shows whether is_code_user exists yet (scripts/076).
  const { data: user, error } = await client.from("users").select("*").eq("id", id).maybeSingle()
  if (error) return NextResponse.json({ error: "Could not load that user" }, { status: 500 })
  if (!user) return NextResponse.json({ error: "No such user" }, { status: 404 })

  if (user.id === auth.siteUserId) {
    return NextResponse.json({ error: "You cannot change your own rank." }, { status: 400 })
  }

  const kickId = user.kick_id ? String(user.kick_id) : null
  const staff = role === "admin" || role === "moderator"
  if (staff && !kickId) {
    return NextResponse.json(
      { error: "This user has never signed in with Kick, so they cannot be given panel access." },
      { status: 400 },
    )
  }

  const isOwner = (await adminTag({ siteUserId: user.id, kickId }))?.isOwner === true
  if (isOwner) {
    return NextResponse.json({ error: "This is the main admin, whose rank cannot be changed here." }, { status: 400 })
  }

  const missing076 = (problem: { code?: string; message?: string }) =>
    problem.code === "42703" || problem.code === "PGRST204" || /role|is_code_user/.test(problem.message ?? "")

  // Staff tag first: it is the part that grants or removes access.
  const tagWrite = staff
    ? await client.from("admin_accounts").upsert(
        // Keyed on the on-site account. The Kick id is copied in so the tag
        // cannot follow a users row that is later pointed at someone else.
        { user_id: user.id, kick_id: kickId, username: user.username, added_by: auth.email, role },
        { onConflict: "user_id" },
      )
    : await client.from("admin_accounts").delete().eq("user_id", user.id)

  if (tagWrite.error) {
    console.error("[admin] Could not change the staff tag:", tagWrite.error)
    const hint = missing076(tagWrite.error) ? "Run scripts/076_ranks.sql in Supabase first." : "Have scripts/070 and 071 been run?"
    return NextResponse.json({ error: `Could not save. ${hint}` }, { status: 500 })
  }

  // Before 076 the column does not exist: there is no flag to clear, and only
  // asking for Code User needs it.
  const flagWrite =
    role === "code_user" || "is_code_user" in user
      ? await client.from("users").update({ is_code_user: role === "code_user" }).eq("id", user.id)
      : { error: null }
  if (flagWrite.error) {
    console.error("[admin] Could not change the Code User flag:", flagWrite.error)
    const hint = missing076(flagWrite.error) ? "Run scripts/076_ranks.sql in Supabase first." : ""
    return NextResponse.json({ error: `Could not save the Code User rank. ${hint}`.trim() }, { status: 500 })
  }

  console.log(`[admin] ${auth.email} set ${user.username} (${kickId ?? "no kick"}) to ${role}`)
  return NextResponse.json({
    admin: { is_admin: staff, rank: role, is_self: false, is_owner: false },
  })
}
