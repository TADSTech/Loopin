import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  bachsBaseUrl,
  buildCheckoutSessionInput,
  minorToAmount,
  productIdForPlan,
  resolveWebhookGrant,
  trialProductIdForPlan,
  verifyBachsSignature,
} from "@/lib/bachs";

const hmac = (secret: string, message: string) =>
  createHmac("sha256", secret).update(message, "utf8").digest("hex");

const baseOptions = {
  plan: "pro" as const,
  currency: "USD" as const,
  userId: "11111111-2222-3333-4444-555555555555",
  userEmail: "jane@example.com",
  successUrl: "https://loopin.test/profile",
  cancelUrl: "https://loopin.test/pricing",
};

describe("bachs money helpers", () => {
  test("minorToAmount formats cents and kobo as decimal strings", () => {
    expect(minorToAmount(500)).toBe("5.00");
    expect(minorToAmount(1900)).toBe("19.00");
    expect(minorToAmount(750_000)).toBe("7500.00");
    expect(minorToAmount(2_850_000)).toBe("28500.00");
  });

  test("bachsBaseUrl picks sandbox vs production from the key prefix", () => {
    expect(bachsBaseUrl("sk_sandbox_abc")).toBe("https://sandbox-api.bachs.io");
    expect(bachsBaseUrl("sk_live_abc")).toBe("https://api.bachs.io");
  });

  test("productIdForPlan reads plan/currency product env vars", () => {
    const savedUsd = process.env.BACHS_PRODUCT_PRO_USD;
    const savedNgn = process.env.BACHS_PRODUCT_PRO_NGN;
    try {
      delete process.env.BACHS_PRODUCT_PRO_USD;
      delete process.env.BACHS_PRODUCT_PRO_NGN;
      expect(productIdForPlan("free", "USD")).toBeNull();
      process.env.BACHS_PRODUCT_PRO_USD = "prod_test123";
      expect(productIdForPlan("pro", "USD")).toBe("prod_test123");
      expect(productIdForPlan("pro", "NGN")).toBeNull();
    } finally {
      if (savedUsd === undefined) delete process.env.BACHS_PRODUCT_PRO_USD;
      else process.env.BACHS_PRODUCT_PRO_USD = savedUsd;
      if (savedNgn === undefined) delete process.env.BACHS_PRODUCT_PRO_NGN;
      else process.env.BACHS_PRODUCT_PRO_NGN = savedNgn;
    }
  });

  test("trialProductIdForPlan reads the _TRIAL product env vars", () => {
    const savedUsd = process.env.BACHS_PRODUCT_PRO_USD_TRIAL;
    const savedNgn = process.env.BACHS_PRODUCT_PRO_NGN_TRIAL;
    try {
      delete process.env.BACHS_PRODUCT_PRO_USD_TRIAL;
      delete process.env.BACHS_PRODUCT_PRO_NGN_TRIAL;
      expect(trialProductIdForPlan("free", "USD")).toBeNull();
      expect(trialProductIdForPlan("pro", "USD")).toBeNull();
      process.env.BACHS_PRODUCT_PRO_USD_TRIAL = "prod_trial123";
      expect(trialProductIdForPlan("pro", "USD")).toBe("prod_trial123");
      expect(trialProductIdForPlan("pro", "NGN")).toBeNull();
    } finally {
      if (savedUsd === undefined)
        delete process.env.BACHS_PRODUCT_PRO_USD_TRIAL;
      else process.env.BACHS_PRODUCT_PRO_USD_TRIAL = savedUsd;
      if (savedNgn === undefined)
        delete process.env.BACHS_PRODUCT_PRO_NGN_TRIAL;
      else process.env.BACHS_PRODUCT_PRO_NGN_TRIAL = savedNgn;
    }
  });
});

describe("buildCheckoutSessionInput", () => {
  test("uses raw pricing when no product id is configured", () => {
    const input = buildCheckoutSessionInput(baseOptions);

    expect(input.pricing).toEqual({ currency: "USD", amount: "5.00" });
    expect(input.product_cart).toBeUndefined();
    expect(input.metadata).toEqual({
      user_id: baseOptions.userId,
      plan: "pro",
      currency: "USD",
    });
    expect(input.customer).toEqual({ email: baseOptions.userEmail });
    expect(input.success_url).toBe(baseOptions.successUrl);
  });

  test("uses a product cart when a product id is configured", () => {
    const input = buildCheckoutSessionInput({
      ...baseOptions,
      currency: "NGN",
      productId: "prod_abc",
    });

    expect(input.product_cart).toEqual([
      { product_id: "prod_abc", quantity: 1 },
    ]);
    expect(input.pricing).toBeUndefined();
    expect(input.metadata).toMatchObject({ plan: "pro", currency: "NGN" });
  });

  test("adds device metadata for trial checkouts", () => {
    const deviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const input = buildCheckoutSessionInput({
      ...baseOptions,
      productId: "prod_trial",
      deviceId,
    });

    expect(input.metadata).toEqual({
      user_id: baseOptions.userId,
      plan: "pro",
      currency: "USD",
      device_id: deviceId,
      trial: "true",
    });
    expect(input.product_cart).toEqual([
      { product_id: "prod_trial", quantity: 1 },
    ]);
  });
});

describe("verifyBachsSignature", () => {
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({
    id: "evt_1",
    type: "collection.succeeded",
    data: {},
  });
  const now = 1_700_000_000;

  test("accepts a valid V2 signature", () => {
    const result = verifyBachsSignature({
      rawBody,
      secret,
      timestamp: null,
      signatureV2: `t=${now},v1=${hmac(secret, `${now}.${rawBody}`)}`,
      signature: null,
      nowSeconds: now,
    });
    expect(result).toBe(true);
  });

  test("accepts when any v1 candidate matches (secret rotation)", () => {
    const result = verifyBachsSignature({
      rawBody,
      secret,
      timestamp: null,
      signatureV2: `t=${now},v1=deadbeef,v1=${hmac(secret, `${now}.${rawBody}`)}`,
      signature: null,
      nowSeconds: now,
    });
    expect(result).toBe(true);
  });

  test("rejects a stale timestamp", () => {
    const stale = now - 400;
    const result = verifyBachsSignature({
      rawBody,
      secret,
      timestamp: null,
      signatureV2: `t=${stale},v1=${hmac(secret, `${stale}.${rawBody}`)}`,
      signature: null,
      nowSeconds: now,
    });
    expect(result).toBe(false);
  });

  test("rejects the wrong secret", () => {
    const result = verifyBachsSignature({
      rawBody,
      secret: "whsec_other",
      timestamp: null,
      signatureV2: `t=${now},v1=${hmac(secret, `${now}.${rawBody}`)}`,
      signature: null,
      nowSeconds: now,
    });
    expect(result).toBe(false);
  });

  test("rejects a tampered body", () => {
    const result = verifyBachsSignature({
      rawBody: `${rawBody} `,
      secret,
      timestamp: null,
      signatureV2: `t=${now},v1=${hmac(secret, `${now}.${rawBody}`)}`,
      signature: null,
      nowSeconds: now,
    });
    expect(result).toBe(false);
  });

  test("supports the legacy header pair", () => {
    const result = verifyBachsSignature({
      rawBody,
      secret,
      timestamp: String(now),
      signatureV2: null,
      signature: hmac(secret, `${now}.${rawBody}`),
      nowSeconds: now,
    });
    expect(result).toBe(true);
  });

  test("rejects when no signature headers are present", () => {
    expect(
      verifyBachsSignature({
        rawBody,
        secret,
        timestamp: null,
        signatureV2: null,
        signature: null,
        nowSeconds: now,
      }),
    ).toBe(false);
  });

  test("rejects a signature of a different length without throwing", () => {
    expect(
      verifyBachsSignature({
        rawBody,
        secret,
        timestamp: String(now),
        signatureV2: null,
        signature: "abc",
        nowSeconds: now,
      }),
    ).toBe(false);
  });
});

describe("resolveWebhookGrant", () => {
  const userId = "11111111-2222-3333-4444-555555555555";
  const deviceId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  test("grants the plan from subscription event metadata", () => {
    expect(
      resolveWebhookGrant("customer.subscription.created", {
        metadata: { user_id: userId, plan: "pro" },
      }),
    ).toEqual({
      action: "grant",
      userId,
      plan: "pro",
      deviceId: null,
      trialOver: false,
    });
  });

  test("grants the plan from checkout session metadata", () => {
    expect(
      resolveWebhookGrant(
        "collection.succeeded",
        { checkout_id: "chk_1" },
        { metadata: { user_id: userId, plan: "team" } },
      ),
    ).toEqual({
      action: "grant",
      userId,
      plan: "team",
      deviceId: null,
      trialOver: false,
    });
  });

  test("keeps a trialing subscription open and stores its dates", () => {
    const result = resolveWebhookGrant("customer.subscription.created", {
      metadata: { user_id: userId, plan: "pro", device_id: deviceId },
      status: "trialing",
      current_period_end: "2026-10-15T00:00:00Z",
      trial_end: "2026-10-15T00:00:00Z",
    });
    expect(result).toEqual({
      action: "grant",
      userId,
      plan: "pro",
      deviceId,
      trialOver: false,
      periodEnd: "2026-10-15T00:00:00Z",
      trialEnd: "2026-10-15T00:00:00Z",
    });
  });

  test("marks the trial over when the subscription leaves trialing", () => {
    const result = resolveWebhookGrant("customer.subscription.updated", {
      metadata: { user_id: userId, plan: "pro", device_id: deviceId },
      status: "active",
      current_period_end: "2026-11-15T00:00:00Z",
      trial_end: null,
    });
    expect(result).toEqual({
      action: "grant",
      userId,
      plan: "pro",
      deviceId,
      trialOver: true,
      periodEnd: "2026-11-15T00:00:00Z",
      trialEnd: null,
    });
  });

  test("only sets period/trial dates the event actually carries", () => {
    const result = resolveWebhookGrant("checkout.completed", {
      checkout_id: "chk_1",
      metadata: { user_id: userId, plan: "pro" },
    });
    expect(result).toEqual({
      action: "grant",
      userId,
      plan: "pro",
      deviceId: null,
      trialOver: false,
    });
    expect(Object.hasOwn(result as object, "periodEnd")).toBe(false);
    expect(Object.hasOwn(result as object, "trialEnd")).toBe(false);
  });

  test("reads metadata from the fetched subscription for invoice.paid", () => {
    const result = resolveWebhookGrant(
      "invoice.paid",
      {
        subscription: { subscription_id: "sub_1" },
        metadata: {},
        period_end: "2026-11-15T00:00:00Z",
      },
      { metadata: { user_id: userId, plan: "pro", device_id: deviceId } },
    );
    expect(result).toEqual({
      action: "grant",
      userId,
      plan: "pro",
      deviceId,
      trialOver: true,
      periodEnd: "2026-11-15T00:00:00Z",
      trialEnd: null,
    });
  });

  test("marks the device only on a failed trial-end charge", () => {
    expect(
      resolveWebhookGrant(
        "invoice.payment_failed",
        {
          subscription: { subscription_id: "sub_1" },
          metadata: {},
        },
        {
          metadata: { user_id: userId, plan: "pro", device_id: deviceId },
        },
      ),
    ).toEqual({ action: "trial_over", userId, deviceId });

    expect(
      resolveWebhookGrant(
        "invoice.payment_failed",
        {
          subscription: { subscription_id: "sub_1" },
          metadata: {},
        },
        { metadata: { user_id: userId, plan: "pro" } },
      ),
    ).toEqual({ action: "ignore" });
  });

  test("cancels on subscription deletion", () => {
    expect(
      resolveWebhookGrant("customer.subscription.deleted", {
        metadata: { user_id: userId, plan: "pro", device_id: deviceId },
      }),
    ).toEqual({ action: "cancel", userId, deviceId, trialOver: true });
  });

  test("ignores events without user metadata", () => {
    expect(resolveWebhookGrant("collection.succeeded", {})).toEqual({
      action: "ignore",
    });
    expect(
      resolveWebhookGrant("collection.succeeded", { metadata: {} }, null),
    ).toEqual({ action: "ignore" });
  });

  test("ignores unknown plans and unknown event types", () => {
    expect(
      resolveWebhookGrant("customer.subscription.created", {
        metadata: { user_id: userId, plan: "free" },
      }),
    ).toEqual({ action: "ignore" });
    expect(
      resolveWebhookGrant("dispute.created", {
        metadata: { user_id: userId, plan: "pro" },
      }),
    ).toEqual({ action: "ignore" });
  });
});
