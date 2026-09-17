import { createClient } from "@supabase/supabase-js"

/**
 * The service-role client, which bypasses RLS.
 *
 * Only ever for route handlers that have already established who is asking —
 * the owner via their cookie, or an admin via their Supabase session. Never
 * import this into anything that runs in the browser: the key is a full
 * bypass of every policy in the database.
 */
export function serviceClient() {
  // The URL and key MUST come from the same Supabase project. Pairing a
  // HUNT_-prefixed var with a non-prefixed one points one project's URL at
  // another project's key and fails with "Invalid API key".
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.HUNT_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.HUNT_SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) throw new Error("Supabase service credentials are not configured")

  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
