import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";

import {
  bachsBaseUrl,
  buildCheckoutSessionInput,
  minorToAmount,
  productIdForPlan,
  resolveWebhookGrant,
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
    expect(productIdForPlan("free", "USD")).toBeNull();
    process.env.BACHS_PRODUCT_PRO_USD = "prod_test123";
    expect(productIdForPlan("pro", "USD")).toBe("prod_test123");
    expect(productIdForPlan("pro", "NGN")).toBeNull();
    delete process.env.BACHS_PRODUCT_PRO_USD;
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

  test("grants the plan from subscription event metadata", () => {
    expect(
      resolveWebhookGrant("customer.subscription.created", {
        metadata: { user_id: userId, plan: "pro" },
      }),
    ).toEqual({ action: "grant", userId, plan: "pro" });
  });

  test("grants the plan from checkout session metadata", () => {
    expect(
      resolveWebhookGrant(
        "collection.succeeded",
        { checkout_id: "chk_1" },
        { metadata: { user_id: userId, plan: "team" } },
      ),
    ).toEqual({ action: "grant", userId, plan: "team" });
  });

  test("cancels on subscription deletion", () => {
    expect(
      resolveWebhookGrant("customer.subscription.deleted", {
        metadata: { user_id: userId, plan: "pro" },
      }),
    ).toEqual({ action: "cancel", userId });
  });

  test("ignores events without user metadata", () => {
    expect(resolveWebhookGrant("collection.succeeded", {})).toEqual({
      action: "ignore",
    });
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
