import { createHmac, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const WEBHOOK_EVENTS = ["extraction.completed", "event.synced"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Random signing secret for a new webhook. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/** Hard ceiling on how long a single webhook POST may take. */
const WEBHOOK_TIMEOUT_MS = 5_000;

/**
 * Rejects delivery targets that point at internal/loopback/link-local hosts.
 * Without this guard, an authenticated user could aim a webhook at
 * 169.254.169.254 (cloud metadata) or internal services (blind SSRF). This is
 * a hostname-based check; a full fix also resolves DNS and inspects the
 * resolved IP. Cloud metadata and RFC1918 ranges are blocked by name/IP-literal.
 */
export function isSsrfSafeTarget(rawUrl: unknown): boolean {
  if (typeof rawUrl !== "string" || rawUrl.length === 0) return false;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return false;
  }

  // IPv4 literals in reserved ranges.
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127) return false; // loopback
    if (a === 10) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 192 && b === 168) return false; // private
    if (a === 169 && b === 254) return false; // link-local / metadata
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 127) return false;
  }
  // IPv6 literals (skip embedded IPv4); block unique-local/link-local.
  if (host.includes(":")) {
    if (
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80") ||
      host.startsWith("::")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Delivers an event to every active webhook the user has registered for it.
 * Payloads are signed with HMAC-SHA256 in the `X-Loopin-Signature` header so
 * receivers can verify authenticity. Each delivery is bounded by a timeout and
 * rejected if it targets an internal host.
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
    if (!isSsrfSafeTarget(hook.url)) {
      console.warn(`[webhooks] skipped unsafe delivery target: ${hook.url}`);
      continue;
    }

    const body = JSON.stringify({
      event,
      sentAt: new Date().toISOString(),
      data: payload,
    });
    const signature = createHmac("sha256", hook.secret)
      .update(body)
      .digest("hex");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Loopin-Event": event,
          "X-Loopin-Signature": `sha256=${signature}`,
        },
        body,
        signal: controller.signal,
      });
      if (response.ok) delivered += 1;
    } catch {
      // Delivery failures are best-effort; a durable retry queue would live
      // on the cloud worker in production.
    } finally {
      clearTimeout(timer);
    }
  }

  return delivered;
}
