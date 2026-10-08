import { NextResponse } from "next/server";

import {
  createBachsCheckoutSession,
  productIdForPlan,
  trialProductIdForPlan,
} from "@/lib/bachs";
import type { Currency, PlanId } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";
import { checkTrialEligibility } from "@/lib/trials";

const VALID_CURRENCIES: Currency[] = ["USD", "NGN"];
const VALID_PLANS: PlanId[] = ["free", "pro", "team"];

/**
 * Starts a paid checkout through Bachs. Requires a signed-in user (lead
 * capture) and returns the hosted checkout URL. Without BACHS_API_KEY
 * configured the route stays in its soft-launch state (503).
 *
 * `trial: true` starts the 7-day free trial instead: eligibility is
 * re-validated here server-side (never-subscribed account + unused
 * device), and the trial product (BACHS_PRODUCT_*_TRIAL) must exist —
 * falling back to a regular product would charge immediately.
 */
export async function POST(request: Request) {
  let body: {
    plan?: string;
    currency?: string;
    trial?: boolean;
    deviceId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const plan = body.plan as PlanId;
  const currency = body.currency as Currency;

  if (!VALID_PLANS.includes(plan) || !VALID_CURRENCIES.includes(currency)) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  if (plan === "free") {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  let productId = productIdForPlan(plan, currency);
  let deviceId: string | null = null;

  if (body.trial === true) {
    const eligibility = await checkTrialEligibility(user.id, body.deviceId);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: "trial_ineligible", reason: eligibility.reason },
        { status: 403 },
      );
    }
    const trialProduct = trialProductIdForPlan(plan, currency);
    if (!trialProduct) {
      return NextResponse.json(
        { error: "trial_not_configured" },
        { status: 503 },
      );
    }
    productId = trialProduct;
    // Non-trial checkouts never carry a device id — trials mark devices,
    // regular purchases must not.
    deviceId = body.deviceId ?? null;
  }

  const origin = new URL(request.url).origin;
  let session: Awaited<ReturnType<typeof createBachsCheckoutSession>>;
  try {
    session = await createBachsCheckoutSession({
      plan,
      currency,
      userId: user.id,
      userEmail: user.email ?? "",
      successUrl: `${origin}/profile`,
      cancelUrl: `${origin}/pricing`,
      productId,
      deviceId,
    });
  } catch (error) {
    console.error("[api/checkout] bachs checkout failed:", error);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }

  if (!session) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  return NextResponse.json({ url: session.checkout_url });
}
