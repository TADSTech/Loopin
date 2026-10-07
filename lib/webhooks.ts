import { createHmac, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const WEBHOOK_EVENTS = ["extraction.completed", "event.synced"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Random signing secret for a new webhook. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/**
 * Delivers an event to every active webhook the user has registered for it.
 * Payloads are signed with HMAC-SHA256 in the `X-Loopin-Signature` header so
 * receivers can verify authenticity.
 */
export async function deliverWebhooks(
  userId: string,
  event: WebhookEvent,
  payload: unknown,
): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;

  const { data: hooks } = await admin
    .from("webhooks")
    .select("url, secret, events")
    .eq("user_id", userId)
    .eq("active", true);

  let delivered = 0;

  for (const hook of hooks ?? []) {
    const subscribed: string[] = hook.events ?? [];
    if (!subscribed.includes(event)) continue;

    const body = JSON.stringify({
      event,
      sentAt: new Date().toISOString(),
      data: payload,
    });
    const signature = createHmac("sha256", hook.secret)
      .update(body)
      .digest("hex");

    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Loopin-Event": event,
          "X-Loopin-Signature": `sha256=${signature}`,
        },
        body,
      });
      if (response.ok) delivered += 1;
    } catch {
      // Delivery failures are best-effort; a durable retry queue would live
      // on the cloud worker in production.
    }
  }

  return delivered;
}
