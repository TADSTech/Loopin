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
