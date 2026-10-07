import { expect, test, describe } from "bun:test";
import {
  extractedEventSchema,
  extractionResultSchema,
} from "@/lib/event-types";

describe("Zod Schema Validations", () => {
  test("extractedEventSchema validates valid event formats", () => {
    const validEvent = {
      title: "Design Sprint",
      start: "2026-07-22T09:00:00Z",
      end: "2026-07-22T17:00:00Z",
      allDay: false,
      location: "Room 101",
      notes: "Bring sticky notes",
      confidence: 0.95,
    };
    const parsed = extractedEventSchema.safeParse(validEvent);
    expect(parsed.success).toBe(true);
  });

  test("extractedEventSchema assigns defaults to missing optional properties", () => {
    const minimalEvent = {
      title: "Quick Standup",
      start: "2026-07-22T09:00:00Z",
    };
    const parsed = extractedEventSchema.safeParse(minimalEvent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.allDay).toBe(false);
      expect(parsed.data.location).toBe("");
      expect(parsed.data.notes).toBe("");
      expect(parsed.data.confidence).toBe(0.5);
    }
  });

  test("extractedEventSchema rejects malformed inputs", () => {
    const malformed = {
      title: "", // empty title
      start: "", // empty start
    };
    const parsed = extractedEventSchema.safeParse(malformed);
    expect(parsed.success).toBe(false);
  });

  test("extractionResultSchema parses complete nested extraction outputs", () => {
    const extractionResult = {
      summary: "Weekly Planning Sprint",
      timezone: "America/New_York",
      events: [
        {
          title: "Setup",
          start: "2026-07-22T09:00:00-04:00",
          confidence: 0.8,
        },
      ],
    };
    const parsed = extractionResultSchema.safeParse(extractionResult);
    expect(parsed.success).toBe(true);
  });
});
