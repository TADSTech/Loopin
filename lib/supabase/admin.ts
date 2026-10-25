import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-only operations, such as
 * persisting Google OAuth tokens that must never reach the browser.
 *
 * Uses the secret key (sb_secret_…), the replacement for the deprecated
 * service_role JWT key. Secret keys are rejected (HTTP 401) if used from a
 * browser. Returns null when unconfigured so callers can degrade gracefully.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    return null;
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * ⚠️ Rumpty Cloud PostgreSQL (commented out — use Supabase Admin client instead)
 * Connect to Rumpty Cloud's managed PostgreSQL from a server with service-role
 * privileges. Uses the connection string from the Rumpty Cloud console.
 *
 * Requires the `pg` package: `bun add pg`
 *
 * // import { Pool } from "pg"
 * // const pool = new Pool({
 * //   connectionString: process.env.RUMPTY_DB_URL,
 * //   ssl: { rejectUnauthorized: false },
 * // })
 *
 * // // Example usage (commented out — use Supabase Admin client instead)
 * // const { data, error } = await pool.query(
 * //   "UPDATE calendar_tokens SET status = 'active' WHERE user_id = $1", [userId]
 * // )
 *
 * // ⚠️ Security: Rumpty Cloud PostgreSQL does NOT have RLS for server-side
 * // direct connections. Only use this if you understand the security
 * // implications and are using it for internal/controlled operations.
 * // Prefer the Supabase Admin client (createAdminClient()) which applies
 * // service-role protections and token management.
 */
