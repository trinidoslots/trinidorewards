import { updateSession } from "@/lib/supabase/middleware"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  /**
   * Only /admin.
   *
   * This used to match every route except static files, and updateSession
   * calls supabase.auth.getUser() — a network round-trip to Supabase's auth
   * server on *every* request, including every public page view and every API
   * call, to decide something only the admin routes ask about. The rest of the
   * site authenticates with a Kick cookie and never had a Supabase session for
   * it to refresh.
   */
  matcher: ["/admin/:path*"],
}
