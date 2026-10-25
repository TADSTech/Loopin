import { NextResponse } from "next/server";

import { safeEqual } from "@/lib/api-keys";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Scheduled reminder processor. Point a cron job (e.g. every minute) at this
 * endpoint with `Authorization: Bearer $CRON_SECRET`. On Rumpty Cloud this maps
 * directly to a managed scheduled job.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: if the secret is not configured, never run the job. Accepting
  // the secret via a query parameter is also removed — bearer tokens must only
  // travel in the Authorization header (query strings are logged everywhere).
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 503 },
    );
  }

  const { data: due } = await admin
    .from("reminders")
    .select("id, user_id, event_title, event_start, channel")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .limit(50);

  // Delivery (email / push) is pluggable here; the queue transition is the
  // durable part that must not be lost.
  let processed = 0;
  for (const reminder of due ?? []) {
    const { error } = await admin
      .from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", reminder.id);
    if (!error) processed += 1;
  }

  return NextResponse.json({ processed, candidates: due?.length ?? 0 });
}

export const POST = GET;
