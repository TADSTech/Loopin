import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (RSC, server actions, route handlers). Reads and
 * refreshes the user's session from HTTP-only cookies. Uses the publishable
 * key (sb_publishable_…), the replacement for the deprecated anon JWT key.
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
