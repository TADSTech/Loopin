"use server";

import { headers } from "next/headers";

import {
  extractEventsFromInput,
  friendlyExtractionMessage,
  isEventPast,
  syncEventsToGoogleCalendar,
  truncateInput,
} from "@/lib/event-intake";
import type { AppState } from "@/lib/event-types";
import {
  getGoogleCalendarCredential,
  isCalendarConnected,
} from "@/lib/google-calendar";
import { clientIp } from "@/lib/ip";
import {
  FREE_MONTHLY_EXTRACTION_LIMIT,
  monthStartIso,
  type PlanId,
} from "@/lib/quota";
import { checkRequest } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkTrialEligibility, type TrialEligibility } from "@/lib/trials";

const initialResult: AppState = {
  status: "idle",
  message: "Drop screenshots, flyers, or notes to extract events.",
  summary: "",
  timezone: "UTC",
  extractedEvents: [],
  syncedEvents: [],
  isAuthenticated: false,
  calendarConnected: false,
  remainingExtractions: null,
  limitReached: false,
  abuse: null,
};

const asString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value : "";

/** The user's plan, defaulting to free when billing is not yet configured. */
async function getUserPlan(userId: string): Promise<PlanId> {
  const admin = createAdminClient();
  if (!admin) return "free";

  const { data } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (data && data.status === "active" && data.plan !== "free") {
    return data.plan as PlanId;
  }
  return "free";
}

/** Number of extractions the user has run this calendar month. */
async function getMonthlyUsage(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("extractions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStartIso());

  return count ?? 0;
}

/** Whether the current user has Google Calendar connected. */
export async function getCalendarStatus(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;
  return isCalendarConnected(user.id);
}

/**
 * Free-trial eligibility for this browser device (+ the signed-in user,
 * if any). Signed-out callers only get the device half of the check; the
 * account half is re-validated when checkout starts.
 */
export async function getTrialEligibility(
  deviceId: string,
): Promise<TrialEligibility> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return checkTrialEligibility(user?.id ?? null, deviceId);
}

/** When the current trial ends, or null when not trialing. */
async function getTrialEnd(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("trial_end")
    .eq("user_id", userId)
    .maybeSingle();
  return typeof data?.trial_end === "string" ? data.trial_end : null;
}

export type AccountSummary = {
  email: string;
  plan: PlanId;
  used: number;
  /** Monthly extraction limit, or null for unlimited (paid). */
  limit: number | null;
  calendarConnected: boolean;
  /** When the current trial ends (ISO), null when not trialing. */
  trialEnd: string | null;
};

/** Profile data for the signed-in user, or null when signed out. */
export async function getAccountSummary(): Promise<AccountSummary | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [plan, used, calendarConnected, trialEnd] = await Promise.all([
    getUserPlan(user.id),
    getMonthlyUsage(user.id),
    isCalendarConnected(user.id),
    getTrialEnd(user.id),
  ]);

  return {
    email: user.email ?? "",
    plan,
    used,
    limit: plan === "free" ? FREE_MONTHLY_EXTRACTION_LIMIT : null,
    calendarConnected,
    trialEnd,
  };
}

export async function ingestEvents(
  _previousState: AppState,
  formData: FormData,
): Promise<AppState> {
  const text = asString(formData.get("sourceText")).trim();
  const timezone = asString(formData.get("timezone")).trim() || "UTC";
  // Manual credentials remain supported for the free / self-host path.
  const manualCalendarId = asString(formData.get("calendarId")).trim();
  const manualAccessToken = asString(formData.get("googleAccessToken")).trim();
  const groqApiKey = asString(formData.get("groqApiKey")).trim();
  const files = formData
    .getAll("images")
    .filter(
      (value): value is File =>
        value instanceof File &&
        value.size > 0 &&
        value.size <= 10 * 1024 * 1024,
    )
    .slice(0, 3);

  // Per-IP abuse guard. Repeatedly exceeding the per-minute extraction rate
  // accrues strikes and escalates to an IP ban enforced across the whole app
  // by middleware (lib/rate-limit.ts).
  const ip = clientIp({ headers: await headers() });
  const guard = checkRequest(
    `ingest:${ip}`,
    { limit: 30, windowMs: 60_000 },
    `ip:${ip}`,
  );
  if (!guard.allowed) {
    return {
      ...initialResult,
      timezone,
      status: "error",
      abuse: {
        kind: guard.banned ? "banned" : "rate_limited",
        retryAfter: guard.retryAfter,
      },
      message: guard.banned
        ? "Too many requests. Access from this network is temporarily paused. Please try again later."
        : `You're going a little too fast. Please wait ${guard.retryAfter}s and try again.`,
    };
  }

  // Resolve the signed-in user, if any.
  let userId: string | null = null;
  let userSupabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    userSupabase = await createClient();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  if (!text && files.length === 0) {
    return {
      ...initialResult,
      status: "error",
      message: "Add some text or at least one image before running extraction.",
      timezone,
      isAuthenticated: Boolean(userId),
    };
  }

  // Plan-aware quota. Anonymous visitors are gated by the sign-up prompt
  // instead of a counter, so they are not blocked here.
  let plan: PlanId = "free";
  let used = 0;
  if (userId) {
    try {
      [plan, used] = await Promise.all([
        getUserPlan(userId),
        getMonthlyUsage(userId),
      ]);
    } catch (error) {
      console.error("[ingestEvents] quota lookup failed:", error);
    }

    if (plan === "free" && used >= FREE_MONTHLY_EXTRACTION_LIMIT) {
      return {
        ...initialResult,
        status: "error",
        message: `You've used all ${FREE_MONTHLY_EXTRACTION_LIMIT} free extractions this month. Upgrade to Pro for unlimited extractions.`,
        timezone,
        isAuthenticated: true,
        remainingExtractions: 0,
        limitReached: true,
      };
    }
  }

  try {
    const extraction = await extractEventsFromInput({
      text,
      timezone,
      files,
      groqApiKey,
    });

    const now = new Date();
    const evaluatedEvents = extraction.events.map((event) => ({
      ...event,
      isPast: isEventPast(event, now),
    }));
    const upcomingEvents = evaluatedEvents.filter((event) => !event.isPast);
    const pastCount = evaluatedEvents.length - upcomingEvents.length;

    // Prefer the signed-in user's connected Google Calendar (one-click setup);
    // otherwise fall back to manually supplied credentials.
    let calendarId = manualCalendarId;
    let accessToken = manualAccessToken;
    let calendarConnected = false;

    if (userId && !accessToken) {
      try {
        const credential = await getGoogleCalendarCredential(userId);
        if (credential) {
          calendarId = credential.calendarId;
          accessToken = credential.accessToken;
          calendarConnected = true;
        }
      } catch (error) {
        console.error(
          "[ingestEvents] calendar credential lookup failed:",
          error,
        );
      }
    }

    let syncedEvents: AppState["syncedEvents"] = [];
    let syncWarning = "";
    if (calendarId && accessToken) {
      try {
        syncedEvents = await syncEventsToGoogleCalendar({
          events: upcomingEvents,
          timezone: extraction.timezone,
          calendarId,
          accessToken,
        });
      } catch (error) {
        console.error("[ingestEvents] calendar sync failed:", error);
        syncWarning =
          " Google Calendar sync failed — your events are still listed. Try syncing again from an event card.";
      }
    }

    // Record usage/lead history for signed-in users (powers the quota).
    if (userId && userSupabase) {
      try {
        const preview = text.slice(0, 140) || `${files.length} image(s)`;
        await userSupabase.from("extractions").insert({
          user_id: userId,
          event_count: evaluatedEvents.length,
          synced_count: syncedEvents.length,
          source_preview: preview,
        });
      } catch (error) {
        console.error("[ingestEvents] usage insert failed:", error);
      }
    }

    const pastMessage =
      pastCount > 0
        ? ` Skipped ${pastCount} event${pastCount === 1 ? "" : "s"} because the deadline has passed.`
        : "";
    const syncMessage = syncedEvents.length
      ? ` Synced ${syncedEvents.length} event${syncedEvents.length === 1 ? "" : "s"} to Google Calendar.`
      : userId
        ? " Connect Google Calendar to auto-sync."
        : " Sign up to sync these to Google Calendar.";

    const remainingExtractions = userId
      ? plan === "free"
        ? Math.max(0, FREE_MONTHLY_EXTRACTION_LIMIT - (used + 1))
        : null
      : null;
    const quotaMessage =
      plan === "free" && remainingExtractions !== null
        ? ` ${remainingExtractions} free extraction${remainingExtractions === 1 ? "" : "s"} left this month.`
        : "";

    const trimMessage = truncateInput(text).truncated
      ? " Some input was trimmed to fit the AI model's limits."
      : "";

    return {
      status: "success",
      message: `Extracted ${extraction.events.length} event${extraction.events.length === 1 ? "" : "s"}.${syncWarning || syncMessage}${quotaMessage}${pastMessage}${trimMessage}`,
      summary: extraction.summary,
      timezone: extraction.timezone,
      extractedEvents: evaluatedEvents,
      syncedEvents,
      isAuthenticated: Boolean(userId),
      calendarConnected,
      remainingExtractions,
      limitReached: false,
    };
  } catch (error) {
    console.error("[ingestEvents] extraction failed:", error);
    return {
      ...initialResult,
      status: "error",
      message: friendlyExtractionMessage(
        error instanceof Error ? error.message : String(error),
      ),
      timezone,
      isAuthenticated: Boolean(userId),
    };
  }
}
