import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (RSC, server actions, route handlers). Reads and
 * refreshes the user's session from HTTP-only cookies. Uses the publishable
 * key (sb_publishable_…), the replacement for the deprecated anon JWT key.
 *
 * ⚠️ ALTERNATIVE: To use Rumpty Cloud's managed PostgreSQL directly,
 * replace the createServerClient call with:
 * ```ts
 * import { db } from "@/lib/rumpty-db"
 * // db is a pooled pg client connected to Rumpty Cloud PostgreSQL
 * ```
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when proxy is
            // refreshing the session.
          }
        },
      },
    },
  );
}

/**
 * ⚠️ Rumpty Cloud PostgreSQL (commented out — use Supabase instead)
 * Connect to Rumpty Cloud's managed PostgreSQL using the connection string
 * from the Rumpty Cloud console (Managed Databases → Create PostgreSQL).
 *
 * Requires the `pg` package: `bun add pg`
 *
 * import { Pool } from "pg"
 * const pool = new Pool({
 *   connectionString: process.env.RUMPTY_DB_URL,
 *   ssl: { rejectUnauthorized: false },
 * })
 *
 * export async function rumptyDbQuery<T>(query: string, params: any[] = []): Promise<T> {
 *   const client = await pool.connect()
 *   try { return await client.query(query, params) as Promise<T> }
 *   finally { client.release() }
 * }
 */
