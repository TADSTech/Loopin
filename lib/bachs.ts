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

export type CheckoutSessionInput = {
  plan: Exclude<PlanId, "free">;
  currency: Currency;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  productId?: string | null;
};

export function buildCheckoutSessionInput(
  options: CheckoutSessionInput,
): Record<string, unknown> {
  const plan = PLANS.find((candidate) => candidate.id === options.plan);
  if (!plan) throw new Error(`unknown plan: ${options.plan}`);

  const amount = minorToAmount(plan.price[options.currency]);
  const base: Record<string, unknown> = {
    customer: { email: options.userEmail },
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: {
      user_id: options.userId,
      plan: options.plan,
      currency: options.currency,
    },
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
  | { action: "grant"; userId: string; plan: "pro" | "team" }
  | { action: "cancel"; userId: string }
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

/**
 * Lenient event -> entitlement mapping. Reads user/plan from event or
 * checkout metadata (Bachs copies checkout metadata onto subscriptions) and
 * ignores anything it does not recognise, per the webhook guidance.
 */
export function resolveWebhookGrant(
  type: string,
  data: Record<string, unknown> | null,
  checkoutSession: Record<string, unknown> | null = null,
): WebhookGrant {
  const metadata =
    asMetadata(data?.metadata) ?? asMetadata(checkoutSession?.metadata) ?? null;
  const userId = metadata?.user_id;
  if (!userId) return { action: "ignore" };

  if (type === "customer.subscription.deleted") {
    return { action: "cancel", userId };
  }

  const plan = metadata?.plan;
  if (plan !== "pro" && plan !== "team") return { action: "ignore" };

  if (
    type === "collection.succeeded" ||
    type === "checkout.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    return { action: "grant", userId, plan };
  }

  return { action: "ignore" };
}
