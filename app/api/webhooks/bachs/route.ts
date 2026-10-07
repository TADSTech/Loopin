import { NextResponse } from "next/server";

import {
  getBachsCheckoutSession,
  resolveWebhookGrant,
  verifyBachsSignature,
} from "@/lib/bachs";
import { createAdminClient } from "@/lib/supabase/admin";

const HANDLED_EVENTS = new Set([
  "collection.succeeded",
  "checkout.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status });

/**
 * Inbound Bachs payment webhooks. The signature is checked against the raw
 * body before parsing; a successful payment upgrades the user's plan (webhooks
 * are the source of truth, never the redirect).
 */
export async function POST(request: Request) {
  const secret = process.env.BACHS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return json({ error: "not_configured" }, 503);
  }

  const rawBody = await request.text();

  const valid = verifyBachsSignature({
    rawBody,
    secret,
    timestamp: request.headers.get("x-bachs-timestamp"),
    signatureV2: request.headers.get("x-bachs-signature-v2"),
    signature: request.headers.get("x-bachs-signature"),
  });
  if (!valid) {
    return json({ error: "invalid_signature" }, 401);
  }

  let event: { id?: string; type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const type = event.type;
  if (!type || !HANDLED_EVENTS.has(type)) {
    return json({ received: true });
  }

  const admin = createAdminClient();
  if (!admin) {
    return json({ error: "storage_unavailable" }, 500);
  }

  // collection.* events carry only a checkout_id; metadata lives on the
  // session (and is copied onto subscriptions at creation).
  let checkoutSession: Record<string, unknown> | null = null;
  const checkoutId =
    typeof event.data?.checkout_id === "string" ? event.data.checkout_id : null;
  if (checkoutId) {
    try {
      checkoutSession = await getBachsCheckoutSession(checkoutId);
    } catch (error) {
      console.error("[bachs-webhook] checkout fetch failed:", error);
      return json({ error: "checkout_fetch_failed" }, 500);
    }
  }

  const grant = resolveWebhookGrant(type, event.data ?? null, checkoutSession);
  if (grant.action === "ignore") {
    console.warn(
      `[bachs-webhook] no entitlement in event ${type} (id=${event.id ?? "?"})`,
    );
    return json({ received: true });
  }

  const now = new Date().toISOString();
  const upsert =
    grant.action === "grant"
      ? admin.from("subscriptions").upsert(
          {
            user_id: grant.userId,
            plan: grant.plan,
            status: "active",
            updated_at: now,
          },
          { onConflict: "user_id" },
        )
      : admin.from("subscriptions").upsert(
          {
            user_id: grant.userId,
            plan: "free",
            status: "canceled",
            current_period_end: null,
            updated_at: now,
          },
          { onConflict: "user_id" },
        );

  const { error } = await upsert;
  if (error) {
    console.error("[bachs-webhook] subscription upsert failed:", error);
    return json({ error: "write_failed" }, 500);
  }

  return json({ received: true, applied: grant.action });
}
