import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /**
   * Every dynamic request, static assets excluded.
   *
   * This was narrowed to /admin once, for a good reason: updateSession called
   * supabase.auth.getUser() on every request, a network round-trip to the auth
   * server to decide something only the admin routes ask about. That round-trip
   * is still scoped to /admin — updateSession returns before it for everything
   * else.
   *
   * The matcher has to be wide because of ADMIN_HOST. A request to
   * admin.trinidorewards.com/users arrives with the path "/users", and
   * middleware is what turns it into /admin/users. Rewrites in next.config run
   * *after* middleware, so doing it there would hand out admin pages that the
   * session check never saw.
   *
   * Cost of the wide matcher: one middleware invocation per dynamic request,
   * doing a couple of string comparisons. If the subdomain is not wanted,
   * putting ["/admin/:path*"] back here is the whole revert.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp4)$).*)"],
}
