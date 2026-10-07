import { expect, test, describe } from "bun:test";
import {
  stripMarkdownFence,
  parseModelJson,
  selectProviderModels,
  isDateOnly,
  addMinutes,
  addDaysToDateOnly,
  normalizeCalendarEvent,
  truncateInput,
  friendlyExtractionMessage,
  MAX_INPUT_CHARS,
  type ProviderModel,
} from "@/lib/event-intake";
import type { ExtractedEvent } from "@/lib/event-types";

describe("event-intake helpers", () => {
  test("stripMarkdownFence removes markdown JSON wrappers", () => {
    const inputs = [
      '```json\n{\n  "summary": "test"\n}\n```',
      '```\n{\n  "summary": "test"\n}\n```',
      '{\n  "summary": "test"\n}',
    ];
    for (const input of inputs) {
      expect(JSON.parse(stripMarkdownFence(input))).toEqual({
        summary: "test",
      });
    }
  });

  test("parseModelJson handles fences and plain JSON", () => {
    const inputs = [
      '```json\n{"summary": "test"}\n```',
      '{"summary": "test"}',
      '  {"summary": "test"}  ',
    ];
    for (const input of inputs) {
      expect(parseModelJson(input)).toEqual({ summary: "test" });
    }
  });

  test("parseModelJson skips prose before the JSON payload", () => {
    expect(
      parseModelJson('Sure! Here is the result:\n{"summary": "test"}'),
    ).toEqual({ summary: "test" });
    expect(
      parseModelJson(
        '{"summary": "first"} trailing junk {"summary": "second"}',
      ),
    ).toEqual({ summary: "first" });
  });

  test("parseModelJson keeps braces inside strings intact", () => {
    expect(
      parseModelJson('{"summary": "notes with } brace and { brace"}'),
    ).toEqual({ summary: "notes with } brace and { brace" });
    expect(parseModelJson('{"summary": "escaped \\" quote"}')).toEqual({
      summary: 'escaped " quote',
    });
  });

  test("parseModelJson rejects non-JSON output with a readable message", () => {
    expect(() => parseModelJson("User Safety: safe")).toThrow(
      /did not return JSON.*User Safety: safe/,
    );
    expect(() => parseModelJson("")).toThrow(/did not return JSON/);
    expect(() => parseModelJson('{"summary": unterminated')).toThrow(
      /did not return JSON/,
    );
  });

  test("isDateOnly matches YYYY-MM-DD format correctly", () => {
    expect(isDateOnly("2026-07-22")).toBe(true);
    expect(isDateOnly("2026-07-22T10:00:00Z")).toBe(false);
    expect(isDateOnly("invalid")).toBe(false);
  });

  test("addMinutes adds time offsets properly", () => {
    const baseTime = "2026-07-16T12:00:00.000Z";
    expect(addMinutes(baseTime, 60)).toBe("2026-07-16T13:00:00.000Z");
    expect(addMinutes("invalid", 60)).toBe("invalid");
  });

  test("addDaysToDateOnly increments date-only strings", () => {
    expect(addDaysToDateOnly("2026-07-22", 1)).toBe("2026-07-23");
    expect(addDaysToDateOnly("invalid", 1)).toBe("invalid");
  });

  test("normalizeCalendarEvent normalizes all-day events", () => {
    const event: ExtractedEvent = {
      title: "Conference Day 1",
      start: "2026-07-22",
      end: null,
      allDay: true,
      location: "",
      notes: "",
      confidence: 1,
    };
    const normalized = normalizeCalendarEvent(event, "America/New_York");
    expect(normalized).toEqual({
      start: { date: "2026-07-22" },
      end: { date: "2026-07-23" },
    });
  });

  test("normalizeCalendarEvent normalizes standard datetime events", () => {
    const event: ExtractedEvent = {
      title: "Sync Meeting",
      start: "2026-07-22T10:00:00.000Z",
      end: "2026-07-22T11:00:00.000Z",
      allDay: false,
      location: "Office",
      notes: "Quick sync",
      confidence: 0.9,
    };
    const normalized = normalizeCalendarEvent(event, "UTC");
    expect(normalized).toEqual({
      start: { dateTime: "2026-07-22T10:00:00.000Z", timeZone: "UTC" },
      end: { dateTime: "2026-07-22T11:00:00.000Z", timeZone: "UTC" },
    });
  });
});

describe("selectProviderModels", () => {
  const model = (
    id: string,
    supportsImage = false,
    promptPrice = 0,
  ): ProviderModel => ({ id, supportsImage, promptPrice });

  test("drops classifiers, guards and meta-routers", () => {
    const selected = selectProviderModels(
      [
        model("nvidia/nemotron-3.5-content-safety:free", true),
        model("openai/gpt-oss-safeguard-20b"),
        model("meta-llama/llama-prompt-guard-2-22m"),
        model("openrouter/free", true),
        model("google/gemma-4-31b-it:free", true),
      ],
      "openrouter",
      true,
    );

    expect(selected).toEqual(["google/gemma-4-31b-it:free"]);
  });

  test("never selects a paid OpenRouter model", () => {
    const selected = selectProviderModels(
      [model("openai/gpt-4o"), model("qwen/qwen3.8-27b:free")],
      "openrouter",
      false,
    );

    expect(selected).toEqual(["qwen/qwen3.8-27b:free"]);
  });

  test("requires image support only when extracting images", () => {
    const pool = [
      model("openai/gpt-oss-120b"),
      model("qwen/qwen3.8-27b", true),
    ];

    expect(selectProviderModels(pool, "groq", true)).toEqual([
      "qwen/qwen3.8-27b",
    ]);
    expect(selectProviderModels(pool, "groq", false)).toEqual([
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-120b",
    ]);
  });

  test("keeps Groq paid models and caps the list at three", () => {
    const selected = selectProviderModels(
      [
        model("allam-2-7b", false, 0.2),
        model("openai/gpt-oss-20b", false, 0.1),
        model("openai/gpt-oss-120b", false, 0.1),
        model("qwen/qwen3.8-27b", false, 0.3),
        model("openai/gpt-oss-safeguard-20b", false, 0.01),
      ],
      "groq",
      false,
    );

    expect(selected).toEqual([
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
      "openai/gpt-oss-120b",
    ]);
    expect(selected).not.toContain("openai/gpt-oss-safeguard-20b");
  });
});

describe("truncateInput", () => {
  test("leaves short input untouched", () => {
    expect(truncateInput("standup at 9am")).toEqual({
      text: "standup at 9am",
      truncated: false,
    });
  });

  test("leaves input exactly at the limit untouched", () => {
    const text = "a".repeat(MAX_INPUT_CHARS);
    expect(truncateInput(text).truncated).toBe(false);
  });

  test("cuts long input at a word boundary", () => {
    const text = "word ".repeat(10_000);
    const result = truncateInput(text);

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(MAX_INPUT_CHARS);
    expect(result.text.endsWith("word")).toBe(true);
  });

  test("prefers cutting at a line break", () => {
    const result = truncateInput("line\n".repeat(5_000));

    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("line")).toBe(true);
  });

  test("hard-cuts input with no whitespace", () => {
    const result = truncateInput("a".repeat(30_000));

    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(MAX_INPUT_CHARS);
  });
});

describe("friendlyExtractionMessage", () => {
  test("maps context-length failures without leaking provider details", () => {
    const raw =
      "All AI providers failed to extract events. groq (llama-3.3-70b-versatile) 400 context_length_exceeded: the input exceeds the model context | openrouter (llama-3.1-8b:free) prompt is too long: 9214 tokens exceeds maximum of 8192";
    const message = friendlyExtractionMessage(raw);

    expect(message).toBe(
      "That input was too long for the AI models. Trim the text or send fewer, smaller screenshots, then try again.",
    );
    expect(message).not.toContain("groq");
    expect(message).not.toContain("llama");
    expect(message).not.toContain("context_length");
  });

  test("context failures win over rate-limit text in the same chain", () => {
    const message = friendlyExtractionMessage(
      "groq 429 rate_limit_exceeded | openrouter context_length_exceeded",
    );

    expect(message).toContain("too long");
  });

  test("maps rate limits to a retry message", () => {
    expect(
      friendlyExtractionMessage("429 rate_limit_exceeded, try again later"),
    ).toBe(
      "The AI service is busy right now. Wait a few seconds and try again.",
    );
  });

  test("maps API key problems to the Developers hint", () => {
    expect(
      friendlyExtractionMessage("401 Incorrect API key provided"),
    ).toContain("Developers");
  });

  test("maps Google rejections to a reconnect hint", () => {
    expect(
      friendlyExtractionMessage(
        'Google Calendar rejected "Standup": 400 invalid recurring event',
      ),
    ).toContain("reconnect Google Calendar");
  });

  test("maps network failures to a connectivity message", () => {
    expect(friendlyExtractionMessage("fetch failed")).toBe(
      "Couldn't reach the AI service. Check your internet connection and try again.",
    );
  });

  test("unknown failures fall back to a generic message", () => {
    expect(friendlyExtractionMessage("weird internal explosion")).toBe(
      "Something went wrong while extracting your events. Please try again.",
    );
  });
});
