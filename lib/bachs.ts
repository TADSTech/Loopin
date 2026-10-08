import { createHmac, timingSafeEqual } from "node:crypto";

import { PLANS, type Currency, type PlanId } from "@/lib/payments";

const SANDBOX_BASE_URL = "https://sandbox-api.bachs.io";
const LIVE_BASE_URL = "https://api.bachs.io";

/** Signature freshness window in seconds (replay protection). */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export function bachsBaseUrl(apiKey: string): string {
  return apiKey.startsWith("sk_live_") ? LIVE_BASE_URL : SANDBOX_BASE_URL;
}

/** Minor units (cents / kobo) -> Bachs decimal string ("500" -> "5.00"). */
export function minorToAmount(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

export function productIdForPlan(
  plan: PlanId,
  currency: Currency,
): string | null {
  if (plan === "free") return null;
  const key = `BACHS_PRODUCT_${plan.toUpperCase()}_${currency}`;
  return process.env[key]?.trim() || null;
}

/**
 * Product with a 7-day free trial window (trial_period set on the Bachs
 * product). Falls back to null when no trial product is configured — the
 * checkout route must then refuse a trial request rather than charge
 * immediately.
 */
export function trialProductIdForPlan(
  plan: PlanId,
  currency: Currency,
): string | null {
  if (plan === "free") return null;
  const key = `BACHS_PRODUCT_${plan.toUpperCase()}_${currency}_TRIAL`;
  return process.env[key]?.trim() || null;
}

export type CheckoutSessionInput = {
  plan: Exclude<PlanId, "free">;
  currency: Currency;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  productId?: string | null;
  /** Browser device id — only sent for trial checkouts, copied onto the
   * subscription metadata so the webhook can mark the device. */
  deviceId?: string | null;
};

export function buildCheckoutSessionInput(
  options: CheckoutSessionInput,
): Record<string, unknown> {
  const plan = PLANS.find((candidate) => candidate.id === options.plan);
  if (!plan) throw new Error(`unknown plan: ${options.plan}`);

  const amount = minorToAmount(plan.price[options.currency]);
  const metadata: Record<string, string> = {
    user_id: options.userId,
    plan: options.plan,
    currency: options.currency,
  };
  if (options.deviceId) {
    metadata.device_id = options.deviceId;
    metadata.trial = "true";
  }
  const base: Record<string, unknown> = {
    customer: { email: options.userEmail },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata,
  };

  if (options.productId) {
    return {
      ...base,
      product_cart: [{ product_id: options.productId, quantity: 1 }],
    };
  }

  return { ...base, pricing: { currency: options.currency, amount } };
}

export type CheckoutSession = {
  checkout_id: string;
  checkout_url: string;
};

export async function createBachsCheckoutSession(
  options: CheckoutSessionInput,
): Promise<CheckoutSession | null> {
  const apiKey = process.env.BACHS_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(`${bachsBaseUrl(apiKey)}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildCheckoutSessionInput(options)),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `bachs checkout failed: ${response.status} ${detail}`.slice(0, 500),
    );
  }

  return (await response.json()) as CheckoutSession;
}

export async function getBachsCheckoutSession(
  checkoutId: string,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.BACHS_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(
    `${bachsBaseUrl(apiKey)}/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `bachs checkout fetch failed: ${response.status} ${detail}`.slice(0, 500),
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

/**
 * Fetch a subscription (used for invoice.* events, which carry only the
 * subscription id — the checkout/sub metadata rides on this object).
 * Throws on failure so the webhook retries.
 */
export async function getBachsSubscription(
  subscriptionId: string,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.BACHS_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(
    `${bachsBaseUrl(apiKey)}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `bachs subscription fetch failed: ${response.status} ${detail}`.slice(
        0,
        500,
      ),
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

export type SignatureHeaders = {
  rawBody: string;
  secret: string;
  timestamp: string | null;
  signatureV2: string | null;
  signature: string | null;
  nowSeconds?: number;
};

const safeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
};

const expectedSignature = (
  secret: string,
  timestamp: number,
  rawBody: string,
) =>
  createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

/**
 * Verifies an X-Bachs-Signature-V2 header (t=...,v1=...; any v1 may match
 * during a secret rotation) or the legacy X-Bachs-Signature +
 * X-Bachs-Timestamp pair. Timestamps outside the tolerance window are
 * rejected to block replays.
 */
export function verifyBachsSignature(headers: SignatureHeaders): boolean {
  const now = headers.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (headers.signatureV2) {
    const parts = headers.signatureV2
      .split(",")
      .map((part) => part.split("=", 2))
      .filter((pair) => pair.length === 2) as [string, string][];
    const timestampText = parts.find(([key]) => key === "t")?.[1];
    const candidates = parts
      .filter(([key]) => key === "v1")
      .map(([, value]) => value);

    const timestamp = Number.parseInt(timestampText ?? "", 10);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = expectedSignature(
      headers.secret,
      timestamp,
      headers.rawBody,
    );
    return candidates.some((candidate) => safeEqualHex(expected, candidate));
  }

  if (headers.signature && headers.timestamp) {
    const timestamp = Number.parseInt(headers.timestamp, 10);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

    const expected = expectedSignature(
      headers.secret,
      timestamp,
      headers.rawBody,
    );
    return safeEqualHex(expected, headers.signature);
  }

  return false;
}

export type WebhookGrant =
  | {
      action: "grant";
      userId: string;
      plan: "pro" | "team";
      /** Device id from checkout metadata — present only for trials. */
      deviceId: string | null;
      /** True once the trial has concluded (invoice billed/failed, or the
       * subscription left trialing / was deleted). */
      trialOver: boolean;
      /** Only set when the event itself carried a period end, so retries
       * never wipe a value a later event already wrote. */
      periodEnd?: string | null;
      /** Only set when the event carried a trial end (or cleared it). */
      trialEnd?: string | null;
    }
  | {
      action: "cancel";
      userId: string;
      deviceId: string | null;
      trialOver: true;
    }
  | { action: "trial_over"; userId: string; deviceId: string | null }
  | { action: "ignore" };

const asMetadata = (value: unknown): Record<string, string> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, raw]) => [
      key,
      String(raw),
    ]),
  );
};

// Key presence only — an explicit null (e.g. trial_end cleared) is meaningful.
const hasField = (data: Record<string, unknown> | null, key: string): boolean =>
  Boolean(data && Object.hasOwn(data, key));

const asIsoOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const GRANT_EVENTS = new Set([
  "collection.succeeded",
  "checkout.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "invoice.paid",
]);

/**
 * Lenient event -> entitlement mapping. Reads user/plan/device from event
 * or related-object metadata (Bachs copies checkout metadata onto
 * subscriptions; invoice events carry only a subscription id, so the
 * route fetches the subscription and passes it as `related`) and ignores
 * anything it does not recognise, per the webhook guidance.
 */
export function resolveWebhookGrant(
  type: string,
  data: Record<string, unknown> | null,
  related: Record<string, unknown> | null = null,
): WebhookGrant {
  const metadata =
    [asMetadata(data?.metadata), asMetadata(related?.metadata)].find(
      (candidate) => candidate?.user_id,
    ) ?? null;
  const userId = metadata?.user_id;
  if (!userId) return { action: "ignore" };

  const deviceId =
    typeof metadata?.device_id === "string" && metadata.device_id
      ? metadata.device_id
      : null;

  if (type === "customer.subscription.deleted") {
    return { action: "cancel", userId, deviceId, trialOver: true };
  }

  // A failed renewal changes no entitlement — it only concludes a trial
  // (the saved card was charged and declined), so mark the device.
  if (type === "invoice.payment_failed") {
    return deviceId
      ? { action: "trial_over", userId, deviceId }
      : { action: "ignore" };
  }

  const plan = metadata?.plan;
  if (plan !== "pro" && plan !== "team") return { action: "ignore" };

  if (GRANT_EVENTS.has(type)) {
    const status = typeof data?.status === "string" ? data.status : null;
    const trialOver =
      type === "invoice.paid" ||
      (type.startsWith("customer.subscription.") &&
        status !== null &&
        status !== "trialing");

    const periodEnd = hasField(data, "current_period_end")
      ? asIsoOrNull(data?.current_period_end)
      : hasField(data, "period_end")
        ? asIsoOrNull(data?.period_end)
        : undefined;
    const trialEnd = hasField(data, "trial_end")
      ? asIsoOrNull(data?.trial_end)
      : type === "invoice.paid"
        ? null
        : undefined;

    return {
      action: "grant",
      userId,
      plan,
      deviceId,
      trialOver,
      ...(periodEnd !== undefined ? { periodEnd } : {}),
      ...(trialEnd !== undefined ? { trialEnd } : {}),
    };
  }

  return { action: "ignore" };
}
