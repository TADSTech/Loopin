import { createAdminClient } from "@/lib/supabase/admin";

export type GoogleCalendarCredential = {
  accessToken: string;
  calendarId: string;
};

/**
 * Returns a valid Google Calendar credential for a user by reading the tokens
 * persisted during the OAuth callback and refreshing them with the stored
 * refresh token when they are near expiry. Returns null when the user has not
 * connected Google Calendar.
 */
export async function getGoogleCalendarCredential(
  userId: string,
): Promise<GoogleCalendarCredential | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: connection } = await admin
    .from("connected_calendars")
    .select("calendar_id, connected")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection?.connected) return null;

  const calendarId = connection.calendar_id || "primary";

  const { data: tokens } = await admin
    .from("calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokens?.access_token) return null;

  const expiresAt = tokens.expires_at
    ? new Date(tokens.expires_at).getTime()
    : 0;

  // Still valid (with a one-minute safety margin).
  if (expiresAt - Date.now() > 60_000) {
    return { accessToken: tokens.access_token, calendarId };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!tokens.refresh_token || !clientId || !clientSecret) {
    return { accessToken: tokens.access_token, calendarId };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    return { accessToken: tokens.access_token, calendarId };
  }

  const refreshed = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!refreshed.access_token) {
    return { accessToken: tokens.access_token, calendarId };
  }

  const expiresIn = refreshed.expires_in ?? 3600;
  await admin
    .from("calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + (expiresIn - 60) * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return { accessToken: refreshed.access_token, calendarId };
}

/** Whether the user currently has Google Calendar connected. */
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { data } = await admin
    .from("connected_calendars")
    .select("connected")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data?.connected);
}
