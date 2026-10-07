import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * OAuth callback. Exchanges the PKCE code for a session and, when the user
 * signed in with Google (one-click setup), stores the provider access/refresh
 * tokens so extraction can auto-sync to Google Calendar without manual input.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?auth_error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/?auth_error=exchange_failed`);
  }

  const { session } = data;
  const providerToken = session.provider_token;
  const providerRefreshToken = session.provider_refresh_token;

  // Persist Google tokens server-side only (never sent to the browser).
  if (providerToken && session.user) {
    const admin = createAdminClient();
    if (admin) {
      const calendarId = "primary";
      const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();

      await admin.from("connected_calendars").upsert(
        {
          user_id: session.user.id,
          calendar_id: calendarId,
          connected: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      await admin.from("calendar_tokens").upsert(
        {
          user_id: session.user.id,
          access_token: providerToken,
          refresh_token: providerRefreshToken,
          expires_at: expiresAt,
        },
        { onConflict: "user_id" },
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
