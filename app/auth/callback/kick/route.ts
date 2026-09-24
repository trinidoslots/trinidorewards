import { serviceClient } from "@/lib/supabase/service"
import { LEGACY_SESSION_COOKIES, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, encodeSession } from "@/lib/site-session"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { adminTag, endSupabaseSession, mintAdminSession } from "@/lib/admin-auth"
import { isAdminPath, safeNext } from "@/lib/admin-host"

/** A cookie value as written by lib/kick-login.ts, which URI-encodes it. */
function readCookie(request: NextRequest, name: string): string | undefined {
  const raw = request.cookies.get(name)?.value
  if (raw === undefined) return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const state = requestUrl.searchParams.get("state")

  console.log("[v0] Kick OAuth callback received", { code: code?.substring(0, 10) + "...", state })

  if (!code) {
    console.error("[v0] No authorization code received")
    return NextResponse.redirect(new URL("/?error=no_code", request.url))
  }

  // The state Kick hands back must be the one this browser sent. Without the
  // check, a callback URL built from someone else's login could be dropped on
  // a visitor and sign them in as that someone. It matters more now that a
  // login can carry admin rights.
  const expectedState = readCookie(request, "kick_oauth_state")
  if (!state || !expectedState || state !== expectedState) {
    console.error("[v0] Kick OAuth state mismatch")
    return NextResponse.redirect(new URL("/?error=state_mismatch", request.url))
  }

  // Where the login was started from. Only a path on this site survives.
  const next = safeNext(readCookie(request, "kick_login_next"), "/")

  try {
    const codeVerifier = readCookie(request, "kick_code_verifier")
    console.log("[v0] Code verifier from cookie:", codeVerifier ? "Found" : "Missing")

    if (!codeVerifier) {
      console.error("[v0] Code verifier missing from cookie")
      return NextResponse.redirect(new URL("/?error=missing_verifier", request.url))
    }

    const tokenParams = {
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_KICK_CLIENT_ID!,
      client_secret: process.env.KICK_CLIENT_SECRET!,
      redirect_uri: `${requestUrl.origin}/auth/callback/kick`,
      code,
      code_verifier: codeVerifier,
    }

    console.log("[v0] Token request params:", {
      ...tokenParams,
      client_secret: "***",
      code: code.substring(0, 10) + "...",
      code_verifier: codeVerifier.substring(0, 10) + "...",
    })

    const tokenEndpoint = "https://id.kick.com/oauth/token"
    console.log("[v0] Using token endpoint:", tokenEndpoint)

    const tokenResponse = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json", // Explicitly request JSON response
      },
      body: new URLSearchParams(tokenParams),
    })

    console.log("[v0] Token response status:", tokenResponse.status)
    console.log("[v0] Token response headers:", Object.fromEntries(tokenResponse.headers.entries()))

    const responseText = await tokenResponse.text()
    console.log("[v0] Token response body (first 500 chars):", responseText.substring(0, 500))

    if (!tokenResponse.ok) {
      console.error("[v0] Token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: responseText,
      })
      return NextResponse.redirect(
        new URL(
          `/?error=token_exchange_failed&details=${encodeURIComponent(responseText.substring(0, 200))}`,
          request.url,
        ),
      )
    }

    let tokenData
    try {
      tokenData = JSON.parse(responseText)
      console.log("[v0] Token data received:", { hasAccessToken: !!tokenData.access_token })
    } catch (parseError) {
      console.error("[v0] Failed to parse token response as JSON:", parseError)
      console.error("[v0] Response was:", responseText)
      return NextResponse.redirect(
        new URL(`/?error=invalid_json&details=${encodeURIComponent(responseText.substring(0, 200))}`, request.url),
      )
    }

    const { access_token } = tokenData

    console.log("[v0] Attempting to fetch user info from multiple endpoints")

    let kickUserId: string | undefined
    let kickUsername: string | undefined
    let kickAvatarUrl: string | undefined

    // Fetching user info from Kick API public endpoint
    console.log("[v0] Fetching user info from Kick API public endpoint")
    const publicApiResponse = await fetch("https://api.kick.com/public/v1/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/json",
      },
    })

    console.log("[v0] Public API response status:", publicApiResponse.status)

    if (publicApiResponse.ok) {
      const publicApiData = await publicApiResponse.json()
      console.log("[v0] Public API response:", JSON.stringify(publicApiData, null, 2))

      if (publicApiData.data && publicApiData.data.length > 0) {
        const userData = publicApiData.data[0]
        kickUserId = String(userData.user_id)
        kickUsername = userData.name
        kickAvatarUrl = userData.profile_picture
        console.log("[v0] Successfully extracted user data:", { kickUserId, kickUsername, kickAvatarUrl })
      }
    }

    // Public API failed, trying fallback endpoints
    if (!kickUserId || !kickUsername) {
      console.log("[v0] Public API failed, trying fallback endpoints")

      // Try OAuth userinfo endpoint
      console.log("[v0] Try 2: OAuth userinfo endpoint")
      const userinfoResponse = await fetch("https://id.kick.com/oauth/userinfo", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json",
        },
      })

      console.log("[v0] Userinfo response status:", userinfoResponse.status)

      if (userinfoResponse.ok) {
        try {
          const userinfoData = await userinfoResponse.json()
          console.log("[v0] Userinfo response:", JSON.stringify(userinfoData, null, 2))

          kickUserId = userinfoData.sub || userinfoData.id || userinfoData.user_id
          kickUsername = userinfoData.username || userinfoData.name || userinfoData.preferred_username
          kickAvatarUrl = userinfoData.picture || userinfoData.avatar_url
        } catch (e) {
          console.log("[v0] Failed to parse userinfo response")
        }
      }
    }

    console.log("[v0] Final extracted user data:", { id: kickUserId, username: kickUsername, avatar: kickAvatarUrl })

    if (!kickUserId || !kickUsername) {
      console.error("[v0] Invalid user data - missing id or username")
      return NextResponse.redirect(
        new URL(
          `/?error=invalid_user_data&details=${encodeURIComponent(JSON.stringify({ kickUserId, kickUsername }))}`,
          request.url,
        ),
      )
    }

    // The service role, not the visitor's anon key: users holds everyone's
    // points, and the database no longer lets the anon key write it (072).
    // This row is only ever touched here for the Kick account Kick just named.
    const supabase = serviceClient()

    const kickUserIdStr = String(kickUserId)

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("kick_id", kickUserIdStr)
      .maybeSingle()

    console.log("[v0] Existing user check:", { found: !!existingUser, error: fetchError })

    let dbUserId: string

    if (!existingUser) {
      // Create new user
      console.log("[v0] Creating new user in database")
      const base = { kick_id: kickUserIdStr, username: kickUsername, points_balance: 0 }

      let { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({ ...base, avatar_url: kickAvatarUrl || null })
        .select()
        .single()

      // The avatar column is new (scripts/047). If the migration has not been
      // run yet, signing in must still work — a missing picture is cosmetic,
      // a login that fails is not.
      if (insertError?.code === "PGRST204" || insertError?.code === "42703") {
        console.warn("[v0] users.avatar_url missing, creating without it:", insertError.message)
        ;({ data: newUser, error: insertError } = await supabase.from("users").insert(base).select().single())
      }

      if (insertError) {
        console.error("[v0] Failed to create user:", insertError)
        return NextResponse.redirect(
          new URL(`/?error=db_error&message=${encodeURIComponent(insertError.message)}`, request.url),
        )
      }

      console.log("[v0] User created successfully:", newUser)
      dbUserId = newUser.id
    } else {
      // Update existing user
      console.log("[v0] Updating existing user in database")
      const patch = { username: kickUsername, updated_at: new Date().toISOString() }

      let { error: updateError } = await supabase
        .from("users")
        // Refreshed on every login: people change their Kick picture, and a
        // stale one in the admin panel is worse than none.
        .update({ ...patch, avatar_url: kickAvatarUrl || null })
        .eq("kick_id", kickUserIdStr)

      if (updateError?.code === "PGRST204" || updateError?.code === "42703") {
        console.warn("[v0] users.avatar_url missing, updating without it:", updateError.message)
        ;({ error: updateError } = await supabase.from("users").update(patch).eq("kick_id", kickUserIdStr))
      }

      if (updateError) {
        console.error("[v0] Failed to update user:", updateError)
      }

      dbUserId = existingUser.id
    }

    // Store session info
    console.log("[v0] Login successful, redirecting to", next)
    const response = NextResponse.redirect(new URL(next, request.url))

    // The admin panel runs on a Supabase session, not on the cookies below
    // (they are not signed). A tagged account gets one here; anyone else has
    // any previous one ended, so signing in as a different Kick account can
    // never leave the last admin's session behind. See lib/admin-auth.ts.
    // The tag is on the on-site account and must name this Kick account too.
    if (await adminTag({ siteUserId: dbUserId, kickId: kickUserIdStr })) {
      const minted = await mintAdminSession(request, response, {
        kickId: kickUserIdStr,
        siteUserId: dbUserId,
        username: kickUsername,
        avatarUrl: kickAvatarUrl || null,
      })
      if (!minted && isAdminPath(next)) {
        response.headers.set("location", new URL("/auth/login?error=admin_session", request.url).toString())
      }
    } else {
      await endSupabaseSession(request, response)
    }

    // One signed cookie instead of four plain ones: see lib/site-session.ts.
    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({ userId: dbUserId, kickId: kickUserIdStr, username: kickUsername, avatarUrl: kickAvatarUrl || null }),
      SESSION_COOKIE_OPTIONS,
    )
    for (const name of LEGACY_SESSION_COOKIES) response.cookies.delete(name)

    response.cookies.delete("kick_code_verifier")
    response.cookies.delete("kick_oauth_state")
    response.cookies.delete("kick_login_next")

    return response
  } catch (error) {
    console.error("[v0] Kick OAuth error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[v0] Error message:", error instanceof Error ? error.message : String(error))
    return NextResponse.redirect(
      new URL(
        `/?error=auth_failed&message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`,
        request.url,
      ),
    )
  }
}
