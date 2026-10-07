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
