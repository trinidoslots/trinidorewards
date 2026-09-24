import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAdminPath, resolvePath, safeNext } from "@/lib/admin-host"
import { adminFromUser } from "@/lib/admin-auth"

export async function updateSession(request: NextRequest) {
  // Where this request actually lands, once ADMIN_HOST has had its say. Every
  // decision below is made about *this*, not about the URL in the address bar,
  // so admin.trinidorewards.com/users is guarded exactly like /admin/users.
  const pathname = resolvePath(request.nextUrl.pathname, request.headers.get("host"), process.env.ADMIN_HOST)

  // The session lookup is a network round-trip to Supabase's auth server, and
  // only the admin routes ask anything of it. Everything else leaves here
  // before paying for it — the rest of the site authenticates with a Kick
  // cookie and never had a Supabase session to refresh.
  if (!isAdminPath(pathname)) {
    return rewriteIfNeeded(request, pathname)
  }

  let supabaseResponse = rewriteIfNeeded(request, pathname)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = rewriteIfNeeded(request, pathname)
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed in is not the same as allowed. The session has to have been minted
  // for a Kick account, and that account has to be tagged as an admin right
  // now — see lib/admin-auth.ts. A Supabase user from anywhere else (the old
  // email logins, a stray sign-up) has no Kick id and gets nothing.
  if (!(await adminFromUser(user))) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/login"
    url.search = ""
    // Come back to the page that was asked for, rather than dropping everyone
    // on the dashboard.
    url.searchParams.set("next", safeNext(pathname))
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

/** NextResponse.next(), or a rewrite when the host implied a different path. */
function rewriteIfNeeded(request: NextRequest, pathname: string) {
  if (pathname === request.nextUrl.pathname) {
    return NextResponse.next({ request })
  }
  const url = request.nextUrl.clone()
  url.pathname = pathname
  return NextResponse.rewrite(url, { request })
}
