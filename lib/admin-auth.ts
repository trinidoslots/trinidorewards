import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"
import { serviceClient } from "@/lib/supabase/service"

/**
 * Who is an admin, and how an admin gets a session.
 *
 * Server-only. The shape of it:
 *
 *   - An admin is a Kick account listed in admin_accounts (scripts/070).
 *   - The Kick login itself is only a set of plain cookies (kick_user_id and
 *     friends). They are not signed, so anyone can set them in their own
 *     browser: fine for "whose points are these", not for the admin panel.
 *   - So when a tagged account signs in with Kick, the callback also gives it
 *     a real Supabase session, a signed JWT the server verifies on every
 *     request. That session carries the Kick id in app_metadata, which only
 *     the service role can write.
 *   - Every admin check asks: is there a verified Supabase user, does its
 *     app_metadata name a Kick id, and is that Kick id tagged right now?
 *
 * The last step is a lookup on every check, so removing a tag takes effect on
 * the next request rather than when the session happens to expire.
 *
 * The Supabase session also keeps every admin page working as it did: they
 * write through the browser Supabase client, which needs one.
 */

/** The address the Supabase auth user for a Kick account is created under. Never mailed. */
export function adminAuthEmail(kickId: string): string {
  return `kick-${kickId}@admins.trinidorewards.com`
}

/** The Kick id a verified Supabase user was minted for, if any. */
export function kickIdOf(user: Pick<User, "app_metadata"> | null | undefined): string | null {
  const value = user?.app_metadata?.kick_id
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/** Whether this Kick account is tagged as an admin. Any failure reads as "no". */
export async function isAdminKickId(kickId: string | null | undefined): Promise<boolean> {
  if (!kickId) return false
  try {
    const { data, error } = await serviceClient()
      .from("admin_accounts")
      .select("kick_id")
      .eq("kick_id", kickId)
      .maybeSingle()
    if (error) {
      console.error("[admin] admin_accounts lookup failed. Has scripts/070 been run?", error)
      return false
    }
    return !!data
  } catch (error) {
    console.error("[admin] admin_accounts lookup failed:", error)
    return false
  }
}

export type AdminIdentity = { kickId: string; username: string | null; avatarUrl: string | null }

/** The admin behind a verified Supabase user, or null. */
export async function adminFromUser(user: User | null | undefined): Promise<AdminIdentity | null> {
  const kickId = kickIdOf(user)
  if (!kickId || !(await isAdminKickId(kickId))) return null
  const meta = user?.user_metadata ?? {}
  return {
    kickId,
    username: typeof meta.kick_username === "string" ? meta.kick_username : null,
    avatarUrl: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  }
}

/**
 * A Supabase client that reads the request's cookies and writes any session
 * change onto `response`, for route handlers that build their own response,
 * where next/headers' cookies() would not reach it.
 */
export function supabaseForResponse(request: NextRequest, response: NextResponse) {
  return createSupabaseServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
}

/**
 * Signs a tagged Kick account into Supabase, writing the session onto `response`.
 *
 * Finds or creates the auth user for this Kick id (app_metadata.kick_id is set
 * by the service role and cannot be changed from the browser), then issues a
 * one-time magic-link token and redeems it on the spot. Nothing is emailed:
 * generateLink only returns the token.
 *
 * Returns false rather than throwing. The caller still logs the person in to
 * the site; they just do not get the panel, and the login page says why.
 */
export async function mintAdminSession(
  request: NextRequest,
  response: NextResponse,
  kick: { kickId: string; username: string; avatarUrl: string | null },
): Promise<boolean> {
  try {
    const admin = serviceClient().auth.admin
    const email = adminAuthEmail(kick.kickId)
    const metadata = { kick_username: kick.username, avatar_url: kick.avatarUrl }

    const created = await admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { kick_id: kick.kickId },
      user_metadata: metadata,
    })

    // Already there from an earlier login is the normal case, and not an error.
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      console.error("[admin] Could not create the admin auth user:", created.error)
      return false
    }

    const link = await admin.generateLink({ type: "magiclink", email })
    if (link.error || !link.data?.properties?.hashed_token) {
      console.error("[admin] Could not issue an admin sign-in token:", link.error)
      return false
    }

    // The address alone is not trusted: an auth user created by hand in the
    // dashboard under this address, without the Kick id, must not get in.
    if (kickIdOf(link.data.user) !== kick.kickId) {
      console.error("[admin] The auth user for this address is not bound to this Kick id; refusing.")
      return false
    }
    // Keeps the name and picture in the admin bar current.
    await admin.updateUserById(link.data.user.id, { user_metadata: metadata })

    const verified = await supabaseForResponse(request, response).auth.verifyOtp({
      type: "magiclink",
      token_hash: link.data.properties.hashed_token,
    })
    if (verified.error || !verified.data.session) {
      console.error("[admin] Could not redeem the admin sign-in token:", verified.error)
      return false
    }
    return true
  } catch (error) {
    console.error("[admin] Minting the admin session failed:", error)
    return false
  }
}

/** Whether the request carries any Supabase session cookie at all. */
export function hasSupabaseCookie(request: Pick<NextRequest, "cookies">): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
}

/** Ends any Supabase session on `response`. Used on sign-out, and when a non-admin signs in. */
export async function endSupabaseSession(request: NextRequest, response: NextResponse): Promise<void> {
  if (!hasSupabaseCookie(request)) return
  try {
    await supabaseForResponse(request, response).auth.signOut({ scope: "local" })
  } catch (error) {
    console.error("[admin] Could not end the Supabase session:", error)
  }
  // signOut only clears what it recognises; a half-written chunked cookie
  // would survive it. Anything sb- left over goes too.
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 })
  }
}
