import { describe, expect, test } from "bun:test";

import {
  checkRequest,
  clearBan,
  getBanStatus,
  rateLimit,
} from "@/lib/rate-limit";

describe("rateLimit (pure)", () => {
  test("allows up to the limit then blocks within the window", () => {
    expect(rateLimit("t1:p", { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    expect(rateLimit("t1:p", { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    expect(rateLimit("t1:p", { limit: 3, windowMs: 60_000 }).allowed).toBe(true);
    const blocked = rateLimit("t1:p", { limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  test("never records strikes (pure limiter cannot ban)", () => {
    for (let i = 0; i < 30; i++) {
      rateLimit("t2p", { limit: 1, windowMs: 60_000 });
    }
    expect(getBanStatus("ip:t2p").banned).toBe(false);
  });
});

describe("checkRequest (rate limit + escalation)", () => {
  test("records strikes on over-limit calls and escalates to an IP ban", () => {
    const ip = "ip:esc1";
    clearBan(ip);
    // First call in the window passes.
    expect(
      checkRequest("esc1:r", { limit: 1, windowMs: 60_000 }, ip).allowed,
    ).toBe(true);

    let sawBan = false;
    for (let i = 0; i < 20; i++) {
      const result = checkRequest(
        "esc1:r",
        { limit: 1, windowMs: 60_000 },
        ip,
      );
      if (result.banned) sawBan = true;
    }
    expect(sawBan).toBe(true);
    expect(getBanStatus(ip).banned).toBe(true);
    expect(getBanStatus(ip).retryAfter).toBeGreaterThan(0);
  });

  test("an active ban denies even a fresh rate key", () => {
    const ip = "ip:esc2";
    clearBan(ip);
    // Burn down the strike budget to trigger the ban.
    checkRequest("esc2:r", { limit: 1, windowMs: 60_000 }, ip);
    for (let i = 0; i < 20; i++) {
      checkRequest("esc2:r", { limit: 1, windowMs: 60_000 }, ip);
    }
    const result = checkRequest(
      "esc2:fresh-key",
      { limit: 1, windowMs: 60_000 },
      ip,
    );
    expect(result.banned).toBe(true);
    expect(result.allowed).toBe(false);
  });

  test("normal traffic under the limit is never banned", () => {
    const ip = "ip:esc3";
    clearBan(ip);
    for (let i = 0; i < 5; i++) {
      const r = checkRequest(`esc3:r:${i}`, { limit: 100, windowMs: 60_000 }, ip);
      expect(r.allowed).toBe(true);
      expect(r.banned).toBe(false);
    }
    expect(getBanStatus(ip).banned).toBe(false);
  });

  test("empty key is never banned", () => {
    expect(getBanStatus("").banned).toBe(false);
  });
});
