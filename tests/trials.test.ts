import { describe, expect, test } from "bun:test";

import { evaluateTrialEligibility, isValidDeviceId } from "@/lib/trials";

describe("isValidDeviceId", () => {
  test("accepts a UUID", () => {
    expect(isValidDeviceId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
    expect(isValidDeviceId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(isValidDeviceId("")).toBe(false);
    expect(isValidDeviceId("not-a-uuid")).toBe(false);
    expect(isValidDeviceId("{aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee}")).toBe(
      false,
    );
    expect(isValidDeviceId("aaaaaaaa-bbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(false);
    expect(isValidDeviceId(42)).toBe(false);
    expect(isValidDeviceId(null)).toBe(false);
    expect(isValidDeviceId(undefined)).toBe(false);
  });
});

describe("evaluateTrialEligibility", () => {
  const fresh = {
    deviceValid: true,
    deviceUsed: false,
    hasSubscription: false,
  };

  test("a fresh device and a never-subscribed account are eligible", () => {
    expect(evaluateTrialEligibility(fresh)).toEqual({
      eligible: true,
      reason: "ok",
    });
  });

  test("a device that already trialed is blocked", () => {
    expect(evaluateTrialEligibility({ ...fresh, deviceUsed: true })).toEqual({
      eligible: false,
      reason: "device_used",
    });
  });

  test("an account that already subscribed is blocked", () => {
    expect(
      evaluateTrialEligibility({ ...fresh, hasSubscription: true }),
    ).toEqual({
      eligible: false,
      reason: "already_subscribed",
    });
  });

  test("an invalid device id is blocked before anything else", () => {
    expect(
      evaluateTrialEligibility({
        deviceValid: false,
        deviceUsed: true,
        hasSubscription: true,
      }),
    ).toEqual({ eligible: false, reason: "invalid_device" });
  });

  test("the device check wins over the account check", () => {
    expect(
      evaluateTrialEligibility({
        ...fresh,
        deviceUsed: true,
        hasSubscription: true,
      }),
    ).toEqual({ eligible: false, reason: "device_used" });
  });
});
