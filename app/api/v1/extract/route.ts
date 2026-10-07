import { NextResponse } from "next/server";

import { hashApiKey } from "@/lib/api-keys";
import { extractEventsFromInput, isEventPast } from "@/lib/event-intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverWebhooks } from "@/lib/webhooks";

/**
 * Public extraction API. Authenticate with `Authorization: Bearer loop_...`.
 * Fire-and-forget webhooks are delivered for `extraction.completed`.
 */
export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";

  if (!key) {
    return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_not_configured" },
      { status: 503 },
    );
  }

  const { data: keyRow } = await admin
    .from("api_keys")
    .select("id, user_id")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (!keyRow) {
    return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  }

  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  let body: { text?: unknown; timezone?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const timezone =
    typeof body?.timezone === "string" && body.timezone.trim()
      ? body.timezone.trim()
      : "UTC";

  if (!text) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  try {
    const extraction = await extractEventsFromInput({
      text,
      timezone,
      files: [],
    });
    const events = extraction.events.map((event) => ({
      ...event,
      isPast: isEventPast(event),
    }));

    await deliverWebhooks(keyRow.user_id, "extraction.completed", {
      summary: extraction.summary,
      timezone: extraction.timezone,
      events,
    });

    return NextResponse.json({
      summary: extraction.summary,
      timezone: extraction.timezone,
      events,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "extraction_failed",
        message: error instanceof Error ? error.message : "Extraction failed.",
      },
      { status: 502 },
    );
  }
}
