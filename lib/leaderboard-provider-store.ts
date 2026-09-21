import { configFromEnv, configFromRow, type ProviderConfig, type ProviderRow } from "@/lib/leaderboard-provider"

/**
 * Reading a provider out of the database.
 *
 * Server-only. leaderboard_providers has RLS on and no policy, so this needs
 * the service-role client — the same shape redemption_payouts uses in 057.
 * Importing this into anything that runs in the browser would not leak the key,
 * because the query would simply return nothing, but it would look like the
 * provider had been deleted.
 */

type SupabaseLike = { from: (table: string) => any }

/** Columns the app reads. Spelled out so a future secret column is not swept in. */
export const PROVIDER_COLUMNS =
  "id, name, base_url, api_key, auth_header, auth_scheme, start_param, end_param, limit_param, " +
  "date_format, max_limit, max_range_days, cache_minutes, rows_path, username_path, score_path, " +
  "avatar_path, ref_path, success_path"

/**
 * The provider a board should be fetched with.
 *
 * Falls back to the environment when the board has none assigned, when the row
 * has been deleted, or when it has been switched off — which is what keeps
 * boards created before the providers table existed working untouched.
 *
 * Returns null only when there is no configured provider at all, so the caller
 * fails closed instead of calling an unauthenticated endpoint.
 */
export async function resolveProvider(
  supabase: SupabaseLike,
  providerId: string | null | undefined,
): Promise<ProviderConfig | null> {
  if (providerId) {
    const { data, error } = await supabase
      .from("leaderboard_providers")
      .select(PROVIDER_COLUMNS)
      .eq("id", providerId)
      .eq("is_active", true)
      .maybeSingle()

    if (error) {
      // Worth a log: falling back silently would make a broken provider look
      // like a working default.
      console.error("[leaderboard] provider lookup failed:", error.message)
    } else if (data) {
      return configFromRow(data as ProviderRow)
    }
  }

  return configFromEnv()
}
