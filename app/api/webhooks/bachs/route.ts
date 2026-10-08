import { NextResponse } from "next/server";

import {
  getBachsCheckoutSession,
  getBachsSubscription,
  resolveWebhookGrant,
  verifyBachsSignature,
} from "@/lib/bachs";
import { isValidDeviceId } from "@/lib/trials";
import { createAdminClient } from "@/lib/supabase/admin";

const HANDLED_EVENTS = new Set([
  "collection.succeeded",
  "checkout.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  // Trial lifecycle: the first invoice after a trial (paid = converted,
  // payment_failed = trial over, card declined — access is kept while
  // payment recovery retries).
  "invoice.paid",
  "invoice.payment_failed",
]);

const json = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status });

/**
 * Inbound Bachs payment webhooks. The signature is checked against the raw
 * body before parsing; a successful payment upgrades the user's plan (webhooks
 * are the source of truth, never the redirect). Trial checkouts also mark the
 * browser device in trial_devices — at trial start (active) and again when
 * the trial concludes (ended) — so the same device can never trial twice.
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

  // Resolve metadata: collection.* / checkout.* carry only a checkout_id
  // (metadata lives on the session); invoice.* carry only a subscription
  // id (Bachs copies checkout metadata onto the subscription).
  let related: Record<string, unknown> | null = null;
  if (type.startsWith("invoice.")) {
    const subscription = event.data?.subscription as
      { subscription_id?: unknown } | undefined;
    const subscriptionId =
      typeof subscription?.subscription_id === "string"
        ? subscription.subscription_id
        : null;
    if (!subscriptionId) {
      return json({ received: true });
    }
    try {
      related = await getBachsSubscription(subscriptionId);
    } catch (error) {
      console.error("[bachs-webhook] subscription fetch failed:", error);
      return json({ error: "subscription_fetch_failed" }, 500);
    }
  } else {
    const checkoutId =
      typeof event.data?.checkout_id === "string"
        ? event.data.checkout_id
        : null;
    if (checkoutId) {
      try {
        related = await getBachsCheckoutSession(checkoutId);
      } catch (error) {
        console.error("[bachs-webhook] checkout fetch failed:", error);
        return json({ error: "checkout_fetch_failed" }, 500);
      }
    }
  }

  const grant = resolveWebhookGrant(type, event.data ?? null, related);
  if (grant.action === "ignore") {
    console.warn(
      `[bachs-webhook] no entitlement in event ${type} (id=${event.id ?? "?"})`,
    );
    return json({ received: true });
  }

  const now = new Date().toISOString();

  // Failed trial-end charge: conclude the trial on the device, keep the
  // entitlement as-is (payment recovery may still succeed).
  if (grant.action === "trial_over") {
    const deviceId = isValidDeviceId(grant.deviceId) ? grant.deviceId : null;
    if (deviceId) {
      const { error } = await admin.from("trial_devices").upsert(
        {
          device_id: deviceId,
          user_id: grant.userId,
          status: "ended",
          ended_at: now,
        },
        { onConflict: "device_id" },
      );
      if (error) {
        console.error("[bachs-webhook] trial device upsert failed:", error);
        return json({ error: "write_failed" }, 500);
      }
    }
    return json({ received: true, applied: "trial_over" });
  }

  const row: Record<string, unknown> =
    grant.action === "grant"
      ? {
          user_id: grant.userId,
          plan: grant.plan,
          status: "active",
          updated_at: now,
        }
      : {
          user_id: grant.userId,
          plan: "free",
          status: "canceled",
          current_period_end: null,
          trial_end: null,
          updated_at: now,
        };

  if (grant.action === "grant") {
    if (grant.periodEnd !== undefined) row.current_period_end = grant.periodEnd;
    if (grant.trialEnd !== undefined) row.trial_end = grant.trialEnd;
  }

  const { error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("[bachs-webhook] subscription upsert failed:", error);
    return json({ error: "write_failed" }, 500);
  }

  // Trial device bookkeeping (only trial checkouts carry a device id).
  if (grant.deviceId && isValidDeviceId(grant.deviceId)) {
    const { error: deviceError } = await admin.from("trial_devices").upsert(
      {
        device_id: grant.deviceId,
        user_id: grant.userId,
        status: grant.trialOver ? "ended" : "active",
        ended_at: grant.trialOver ? now : null,
      },
      { onConflict: "device_id" },
    );
    if (deviceError) {
      console.error("[bachs-webhook] trial device upsert failed:", deviceError);
      return json({ error: "write_failed" }, 500);
    }
  }

  return json({ received: true, applied: grant.action });
}
