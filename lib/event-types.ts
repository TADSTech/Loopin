import { z } from "zod";

export const extractedEventSchema = z.object({
  title: z.string().min(1),
  start: z.string().min(1),
  end: z.string().nullable().optional(),
  allDay: z.boolean().default(false),
  location: z.string().default(""),
  notes: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const extractionResultSchema = z.object({
  summary: z.string().min(1),
  timezone: z.string().min(1),
  events: z.array(extractedEventSchema),
});

// Lenient shape for raw model output, which sometimes returns null for
// fields it couldn't confidently extract. Events failing to meet the
// stricter extractedEventSchema are dropped rather than failing the batch.
export const rawExtractedEventSchema = z.object({
  title: z.string().nullable().optional(),
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  allDay: z.boolean().nullable().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
});

export const rawExtractionResultSchema = z.object({
  summary: z.string().min(1),
  timezone: z.string().min(1),
  events: z.array(rawExtractedEventSchema),
});

export type ExtractedEvent = z.infer<typeof extractedEventSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type EvaluatedEvent = ExtractedEvent & { isPast: boolean };

export type CalendarSyncResult = {
  title: string;
  htmlLink: string | null;
  start: string;
  end: string;
};

export type AppState = {
  status: "idle" | "success" | "error";
  message: string;
  summary: string;
  timezone: string;
  extractedEvents: EvaluatedEvent[];
  syncedEvents: CalendarSyncResult[];
  /** Whether the request carried a signed-in Supabase user. */
  isAuthenticated: boolean;
  /** Whether the user has Google Calendar connected for auto-sync. */
  calendarConnected: boolean;
  /**
   * Extractions remaining this month. `null` means unlimited (paid) or
   * anonymous (results are gated, not counted).
   */
  remainingExtractions: number | null;
  /** Whether the free monthly quota is exhausted. */
  limitReached: boolean;
};
