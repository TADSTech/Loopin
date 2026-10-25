import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses the publishable key (sb_publishable_…), the
 * replacement for the deprecated anon JWT key. Safe to expose — RLS applies.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * ⚠️ Rumpty Cloud PostgreSQL (commented out — use Supabase Browser client instead)
 * Connect to Rumpty Cloud's managed PostgreSQL from the browser using the
 * connection string from the Rumpty Cloud console.
 *
 * Requires the `pg` package: `bun add pg`
 *
 * // import { Pool } from "pg"
 * // const pool = new Pool({
 * //   connectionString: process.env.RUMPTY_DB_URL,
 * //   ssl: { rejectUnauthorized: false },
 * // })
 *
 * // // Example query (commented out — use Supabase Browser client for RLS)
 * // const { data, error } = await pool.query(
 * //   "SELECT * FROM profiles WHERE id = $1", [userId]
 * // )
 *
 * // ⚠️ Note: Rumpty Cloud PostgreSQL does NOT have RLS enabled for browser access.
 * // Use Supabase Browser client (createClient()) for all data operations
 * // to benefit from Row Level Security.
 */
