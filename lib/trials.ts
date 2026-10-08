import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Browser device IDs are UUID v4 values generated client-side (see
 * lib/device-id.ts) and persisted in localStorage. They gate the free
 * trial: a device that already started a trial can never start another.
 * This is a soft, best-effort control (clearing storage resets it); the
 * hard control is the "never subscribed before" account check.
 */
const DEVICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value);
}

export type TrialReason =
  | "ok"
  | "invalid_device"
  | "device_used"
  | "already_subscribed"
  | "unavailable";

export type TrialEligibility = {
  eligible: boolean;
  reason: TrialReason;
};

/** Pure decision core so the rules stay unit-testable. */
export function evaluateTrialEligibility(input: {
  deviceValid: boolean;
  deviceUsed: boolean;
  hasSubscription: boolean;
}): TrialEligibility {
  if (!input.deviceValid) return { eligible: false, reason: "invalid_device" };
  if (input.deviceUsed) return { eligible: false, reason: "device_used" };
  if (input.hasSubscription) {
    return { eligible: false, reason: "already_subscribed" };
  }
  return { eligible: true, reason: "ok" };
}

/**
 * Free-trial eligibility: a valid device that has never trialed, and a
 * user (when signed in) who has never had a subscription row. Signed-out
 * callers get the device half of the check only — the account half is
 * re-validated server-side when checkout starts.
 */
export async function checkTrialEligibility(
  userId: string | null,
  deviceId: unknown,
): Promise<TrialEligibility> {
  const deviceValid = isValidDeviceId(deviceId);
  if (!deviceValid) return { eligible: false, reason: "invalid_device" };

  const admin = createAdminClient();
  if (!admin) return { eligible: false, reason: "unavailable" };

  const [device, subscription] = await Promise.all([
    admin
      .from("trial_devices")
      .select("device_id")
      .eq("device_id", deviceId)
      .maybeSingle(),
    userId
      ? admin
          .from("subscriptions")
          .select("user_id")
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (device.error || subscription.error) {
    console.error(
      "[trials] eligibility lookup failed:",
      device.error ?? subscription.error,
    );
    return { eligible: false, reason: "unavailable" };
  }

  return evaluateTrialEligibility({
    deviceValid,
    deviceUsed: Boolean(device.data),
    hasSubscription: Boolean(subscription.data),
  });
}
