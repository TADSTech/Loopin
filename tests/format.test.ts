import { expect, test, describe } from "bun:test";
import { formatEventWhen } from "@/lib/format";

describe("formatEventWhen", () => {
  test("formats an ISO timestamp with offset, preserving wall clock", () => {
    expect(formatEventWhen("2026-10-31T08:00:00+01:00")).toBe(
      "Sat, Oct 31, 2026 · 8:00 AM",
    );
  });

  test("formats a UTC ISO timestamp as written", () => {
    expect(formatEventWhen("2026-10-31T08:00:00Z")).toBe(
      "Sat, Oct 31, 2026 · 8:00 AM",
    );
  });

  test("formats milliseconds from Google-normalized timestamps", () => {
    expect(formatEventWhen("2026-10-31T07:00:00.000Z")).toBe(
      "Sat, Oct 31, 2026 · 7:00 AM",
    );
  });

  test("formats date-only values without a time", () => {
    expect(formatEventWhen("2026-07-22")).toBe("Wed, Jul 22, 2026");
  });

  test("same-day range shows one date and both times", () => {
    expect(
      formatEventWhen("2026-10-31T08:00:00Z", "2026-10-31T10:00:00Z"),
    ).toBe("Sat, Oct 31, 2026 · 8:00 AM – 10:00 AM");
  });

  test("cross-day range shows full labels on both sides", () => {
    expect(
      formatEventWhen("2026-10-31T08:00:00Z", "2026-11-01T10:00:00Z"),
    ).toBe("Sat, Oct 31, 2026 · 8:00 AM – Sun, Nov 1, 2026 · 10:00 AM");
  });

  test("converts to the given IANA timezone", () => {
    expect(formatEventWhen("2026-10-31T07:00:00Z", null, "Africa/Lagos")).toBe(
      "Sat, Oct 31, 2026 · 8:00 AM",
    );
  });

  test("invalid timezone falls back to the wall clock", () => {
    expect(formatEventWhen("2026-10-31T08:00:00Z", null, "Not/AZone")).toBe(
      "Sat, Oct 31, 2026 · 8:00 AM",
    );
  });

  test("date-only values are never shifted by a timezone", () => {
    expect(formatEventWhen("2026-07-22", null, "America/New_York")).toBe(
      "Wed, Jul 22, 2026",
    );
  });

  test("passes non-ISO input through unchanged", () => {
    expect(formatEventWhen("sometime soon")).toBe("sometime soon");
  });

  test("returns empty string for missing start", () => {
    expect(formatEventWhen(null)).toBe("");
    expect(formatEventWhen(undefined)).toBe("");
    expect(formatEventWhen("")).toBe("");
    expect(formatEventWhen(null, "2026-10-31T08:00:00Z")).toBe("");
  });

  test("ignores an unusable end", () => {
    expect(formatEventWhen("2026-10-31T08:00:00Z", "soon")).toBe(
      "Sat, Oct 31, 2026 · 8:00 AM",
    );
  });
});
