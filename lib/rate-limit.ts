/**
 * Lightweight in-memory rate limiter + abuse escalation.
 *
 * IMPORTANT: process memory is not shared across serverless instances, so this
 * is best-effort, per-instance protection. For a multi-instance production
 * deployment, back the windows/violations/bans with a shared store (Upstash
 * Redis / Vercel KV) using the same keys; the API below is store-agnostic.
 *
 * Abuse model:
 *  - A request that exceeds its limit records one "strike" against `strikeKey`
 *    (we key strikes/bans on the client IP).
 *  - Reaching STRIKE_THRESHOLD strikes inside STRIKE_WINDOW_MS escalates to an
 *    IP ban lasting BAN_DURATION_MS.
 *  - The proxy/middleware checks `getBanStatus(ip)` on every request and serves
 *    a 403 to a banned IP, so a banned caller can't bypass the limit by
 *    reloading pages or switching endpoints.
 * Thresholds are env-tunable so the operator can tighten/loosen without a
 * code change.
 */

type Window = { count: number; resetAt: number };
type Violation = { strikes: number; windowStart: number };
type Ban = { until: number };

const windows = new Map<string, Window>();
const violations = new Map<string, Violation>();
const bans = new Map<string, Ban>();

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STRIKE_WINDOW_MS = num(
  process.env.RATE_STRIKE_WINDOW_MS,
  10 * 60_000, // accumulate strikes across a 10-minute window
);
const STRIKE_THRESHOLD = num(process.env.RATE_STRIKE_THRESHOLD, 8); // blocks -> ban
const BAN_DURATION_MS = num(process.env.RATE_BAN_DURATION_MS, 15 * 60_000);

export type RateLimitOptions = {
  /** Maximum requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfter: number;
};

export type CheckResult = RateLimitResult & {
  /** True when the caller is currently banned. */
  banned: boolean;
};

/** Current ban status for a key (empty strings never match a ban). */
export function getBanStatus(key: string): { banned: boolean; retryAfter: number } {
  if (!key) return { banned: false, retryAfter: 0 };
  const ban = bans.get(key);
  if (!ban) return { banned: false, retryAfter: 0 };
  if (ban.until <= Date.now()) {
    bans.delete(key);
    return { banned: false, retryAfter: 0 };
  }
  return {
    banned: true,
    retryAfter: Math.ceil((ban.until - Date.now()) / 1000),
  };
}

export function isBanned(key: string): boolean {
  return getBanStatus(key).banned;
}

/** Lifts a ban early and clears any accrued strikes (admin/support use). */
export function clearBan(key: string): void {
  bans.delete(key);
  violations.delete(key);
}

/** Records a strike; escalates to a ban when the threshold is crossed. */
function recordViolation(key: string): { banned: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = violations.get(key);

  if (!existing || now - existing.windowStart > STRIKE_WINDOW_MS) {
    violations.set(key, { strikes: 1, windowStart: now });
    return { banned: false, retryAfter: 0 };
  }

  existing.strikes += 1;
  if (existing.strikes >= STRIKE_THRESHOLD) {
    bans.set(key, { until: now + BAN_DURATION_MS });
    violations.delete(key);
    return {
      banned: true,
      retryAfter: Math.ceil(BAN_DURATION_MS / 1000),
    };
  }
  return { banned: false, retryAfter: 0 };
}

/** Pure fixed-window limiter (does not record strikes). */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfter: 0 };
  }

  if (existing.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: options.limit - existing.count, retryAfter: 0 };
}

/**
 * Full guard: checks the ban list first, then the rate limit, then records a
 * strike (keyed by `strikeKey`, normally the client IP) on a block and
 * escalates to a ban if the threshold is reached.
 */
export function checkRequest(
  rateKey: string,
  options: RateLimitOptions,
  strikeKey = rateKey,
): CheckResult {
  const ban = getBanStatus(strikeKey);
  if (ban.banned) {
    return { allowed: false, banned: true, remaining: 0, retryAfter: ban.retryAfter };
  }

  const result = rateLimit(rateKey, options);
  if (result.allowed) {
    return { ...result, banned: false };
  }

  const escalation = recordViolation(strikeKey);
  return {
    allowed: false,
    banned: escalation.banned,
    remaining: 0,
    retryAfter: escalation.banned ? escalation.retryAfter : result.retryAfter,
  };
}
