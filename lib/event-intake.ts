import OpenAI from "openai";

import {
  extractedEventSchema,
  rawExtractionResultSchema,
  type CalendarSyncResult,
  type ExtractionResult,
  type ExtractedEvent,
} from "./event-types";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// Hardcoded last resort when a provider's /models listing is unreachable.
const GROQ_FALLBACK_MODELS = [
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3.8-27b",
];
const OPENROUTER_FALLBACK_MODELS = ["openrouter/free"];

// Preference order for picking a model when several qualify.
const MODEL_PREFERENCE = [
  "llama-4",
  "llama-3",
  "qwen3",
  "qwen",
  "gpt-oss",
  "gemma",
  "mistral",
  "deepseek",
  "gemini",
  "nemotron",
  "inkling",
];

// Models whose id betrays a non-assistant role (classifiers, embeddings,
// speech, image generation). Routing to one of these produces garbage output
// such as "User Safety: safe".
const UNUSABLE_MODEL =
  /safety|guard|moderation|shield|embedding|whisper|tts|speech|transcri|diffusion|rerank|prompt/i;

const MODELS_PER_PROVIDER = 3;
const MODEL_CACHE_TTL_MS = 10 * 60_000;

export const MAX_INPUT_CHARS = 24_000;

export const truncateInput = (
  text: string,
  max: number = MAX_INPUT_CHARS,
): { text: string; truncated: boolean } => {
  if (text.length <= max) return { text, truncated: false };

  const cut = Math.max(text.lastIndexOf("\n", max), text.lastIndexOf(" ", max));
  const end = cut > max / 2 ? cut : max;
  return { text: text.slice(0, end), truncated: true };
};

export const friendlyExtractionMessage = (raw: string): string => {
  const lower = raw.toLowerCase();

  if (
    /context_length|prompt is too long|maximum context|context window|input tokens exceed|too many tokens|exceeds.{0,20}context/.test(
      lower,
    )
  ) {
    return "That input was too long for the AI models. Trim the text or send fewer, smaller screenshots, then try again.";
  }

  if (/rate.?limit|too many requests|429/.test(lower)) {
    return "The AI service is busy right now. Wait a few seconds and try again.";
  }

  if (
    /insufficient_quota|exceeded your current quota|billing|out of credit/.test(
      lower,
    )
  ) {
    return "The AI provider's usage limit has been reached. Please try again later.";
  }

  if (/invalid_api_key|incorrect api key|unauthorized|401/.test(lower)) {
    return "The AI provider rejected the API key. If you added your own key, check it in Developers. Otherwise, please try again later.";
  }

  if (
    /google calendar rejected|invalid_grant|google.{0,30}(reject|refus|permission)/.test(
      lower,
    )
  ) {
    return "Google Calendar refused the sync. Your extracted events are safe — reconnect Google Calendar and try again.";
  }

  if (
    /connection|fetch failed|network|timed? ?out|etimedout|econnreset|socket|enotfound|dns/.test(
      lower,
    )
  ) {
    return "Couldn't reach the AI service. Check your internet connection and try again.";
  }

  return "Something went wrong while extracting your events. Please try again.";
};

export type ProviderKind = "groq" | "openrouter";

export type ProviderModel = {
  id: string;
  supportsImage: boolean;
  promptPrice: number;
};

type ExtractionCandidate = {
  name: string;
  model: string;
  client: OpenAI;
};

const modelCache = new Map<
  string,
  { expiresAt: number; models: ProviderModel[] }
>();

const listGroqModels = async (apiKey: string): Promise<ProviderModel[]> => {
  const response = await fetch(`${GROQ_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`Groq /models returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      input_modalities?: string[];
      pricing?: { prompt?: string };
    }>;
  };

  return (payload.data ?? [])
    .filter((model) => typeof model.id === "string")
    .map((model) => ({
      id: model.id as string,
      supportsImage: (model.input_modalities ?? []).includes("image"),
      promptPrice: Number(model.pricing?.prompt ?? 0) || 0,
    }));
};

const listOpenRouterModels = async (): Promise<ProviderModel[]> => {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`);

  if (!response.ok) {
    throw new Error(`OpenRouter /models returned ${response.status}.`);
  }

  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      architecture?: { input_modalities?: string[] };
      pricing?: { prompt?: string };
    }>;
  };

  return (payload.data ?? [])
    .filter((model) => typeof model.id === "string")
    .map((model) => ({
      id: model.id as string,
      supportsImage: (model.architecture?.input_modalities ?? []).includes(
        "image",
      ),
      promptPrice: Number(model.pricing?.prompt ?? 0) || 0,
    }));
};

const preferenceScore = (id: string) => {
  const lower = id.toLowerCase();
  const index = MODEL_PREFERENCE.findIndex((token) => lower.includes(token));
  return index === -1 ? MODEL_PREFERENCE.length : index;
};

/**
 * Ranks a provider's model list down to the handful worth trying.
 * Excludes classifiers/embeddings/speech, OpenRouter's meta-routers (they
 * pick arbitrary models, including safety classifiers), paid OpenRouter
 * models, and models that can't take images when we need vision.
 */
export const selectProviderModels = (
  pool: ProviderModel[],
  kind: ProviderKind,
  needsImage: boolean,
): string[] =>
  pool
    .filter((model) => !UNUSABLE_MODEL.test(model.id))
    // OpenRouter routers pick arbitrary providers; only pinned ids are safe.
    .filter(
      (model) => !(kind === "openrouter" && model.id.startsWith("openrouter/")),
    )
    // The managed OpenRouter key must never spend on paid models.
    .filter((model) => kind !== "openrouter" || model.id.endsWith(":free"))
    .filter((model) => (needsImage ? model.supportsImage : true))
    .sort(
      (a, b) =>
        preferenceScore(a.id) - preferenceScore(b.id) ||
        a.promptPrice - b.promptPrice ||
        a.id.length - b.id.length,
    )
    .slice(0, MODELS_PER_PROVIDER)
    .map((model) => model.id);

/**
 * Lists usable chat models for a provider, ranked by preference and price.
 * Cached briefly so repeated extractions don't re-hit /models.
 */
const discoverModels = async (
  kind: ProviderKind,
  apiKey: string,
  needsImage: boolean,
): Promise<string[]> => {
  const cacheKey = `${kind}:${apiKey.slice(-6)}`;
  const cached = modelCache.get(cacheKey);
  const now = Date.now();
  let models: ProviderModel[] | null =
    cached && cached.expiresAt > now ? cached.models : null;

  if (!models) {
    try {
      models =
        kind === "groq"
          ? await listGroqModels(apiKey)
          : await listOpenRouterModels();
      modelCache.set(cacheKey, { expiresAt: now + MODEL_CACHE_TTL_MS, models });
    } catch {
      models = null;
    }
  }

  const pool =
    models ??
    // Discovery failed — fall back to known-good ids (may 404; the caller
    // simply moves on to the next candidate).
    (kind === "groq"
      ? GROQ_FALLBACK_MODELS.map((id) => ({
          id,
          supportsImage: true,
          promptPrice: 0,
        }))
      : OPENROUTER_FALLBACK_MODELS.map((id) => ({
          id,
          supportsImage: true,
          promptPrice: 0,
        })));

  const usable = selectProviderModels(pool, kind, needsImage);

  return usable.length > 0
    ? usable
    : kind === "groq"
      ? GROQ_FALLBACK_MODELS
      : OPENROUTER_FALLBACK_MODELS;
};

/**
 * Builds the ordered list of AI providers to try for an extraction.
 * - A user-supplied Groq key is used exclusively (their key, their cost).
 * - Otherwise the managed path tries Groq first, then OpenRouter's free models.
 */
const buildCandidates = async (
  hasImages: boolean,
  customApiKey?: string,
): Promise<ExtractionCandidate[]> => {
  const candidates: ExtractionCandidate[] = [];
  const groqKey = customApiKey || process.env.GROQ_API_KEY;

  if (groqKey) {
    const groqName = customApiKey ? "your Groq key" : "Groq";
    const client = new OpenAI({
      apiKey: groqKey,
      baseURL: GROQ_BASE_URL,
      maxRetries: 0,
    });

    for (const model of await discoverModels("groq", groqKey, hasImages)) {
      candidates.push({ name: groqName, model, client });
    }
  }

  // Managed fallback to OpenRouter's free models (never for BYO keys).
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!customApiKey && openRouterKey) {
    const client = new OpenAI({
      apiKey: openRouterKey,
      baseURL: OPENROUTER_BASE_URL,
      maxRetries: 0,
      defaultHeaders: {
        "HTTP-Referer": "https://loopin.app",
        "X-Title": "Loopin",
      },
    });

    for (const model of await discoverModels(
      "openrouter",
      openRouterKey,
      hasImages,
    )) {
      candidates.push({ name: "OpenRouter (free)", model, client });
    }
  }

  return candidates;
};

export const stripMarkdownFence = (value: string) =>
  value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

const findBalancedEnd = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
};

const preview = (value: string) =>
  value.replace(/\s+/g, " ").trim().slice(0, 160);

/**
 * Pulls the first parseable JSON object out of raw model output.
 * Providers and safety classifiers sometimes wrap or replace the payload
 * (e.g. a bare `User Safety: safe` reply), so the caller must never hand
 * raw content straight to JSON.parse.
 */
export const parseModelJson = (content: string): unknown => {
  const text = stripMarkdownFence(content);
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const start = text.indexOf("{", searchFrom);

    if (start === -1) {
      break;
    }

    const end = findBalancedEnd(text, start);

    if (end === -1) {
      break;
    }

    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      searchFrom = start + 1;
    }
  }

  throw new Error(
    `the model did not return JSON (it said: "${preview(content)}")`,
  );
};

export const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const addMinutes = (value: string, minutes: number) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

export const addDaysToDateOnly = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const fileToDataUrl = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  return `data:${file.type || "application/octet-stream"};base64,${base64}`;
};

const buildPrompt = (inputText: string, timezone: string) => `
You extract calendar events from messy notes, screenshots, flyers, and pasted text.

Return JSON only with this exact shape:
{
  "summary": string,
  "timezone": string,
  "events": [
    {
      "title": string,
      "start": string,
      "end": string | null,
      "allDay": boolean,
      "location": string,
      "notes": string,
      "confidence": number
    }
  ]
}

Rules:
- Use ISO 8601 timestamps with timezone offsets when a time is present.
- Use date-only values like 2026-07-22 for all-day events.
- If a time range is missing, infer a reasonable one-hour event and set confidence lower.
- Keep confidence between 0 and 1.
- Put any uncertainty in the notes field.
- The timezone to use is ${timezone}.
- Every event MUST have a non-null "title" and "start". If you cannot
  determine a start date/time for something, omit that event entirely
  rather than including it with a null or empty start.

Input:
${inputText}
`;

export async function extractEventsFromInput(params: {
  text: string;
  timezone: string;
  files: File[];
  groqApiKey?: string;
}): Promise<ExtractionResult> {
  const imageInputs = await Promise.all(
    params.files.slice(0, 3).map(async (file) => ({
      type: "image_url" as const,
      image_url: { url: await fileToDataUrl(file) },
    })),
  );

  const hasImages = imageInputs.length > 0;
  const candidates = await buildCandidates(hasImages, params.groqApiKey);

  if (candidates.length === 0) {
    throw new Error(
      "No AI provider configured. Add GROQ_API_KEY or OPENROUTER_API_KEY, or set your own Groq key in your profile.",
    );
  }

  const input = truncateInput(params.text);
  const sourceText = input.truncated
    ? `${input.text}\n\n[Note: the input above was truncated to fit the AI model's limits.]`
    : input.text;
  const prompt = buildPrompt(sourceText, params.timezone);
  const failures: string[] = [];

  // Try each candidate in order; fall through to the next on any failure.
  for (const candidate of candidates) {
    try {
      const response = await candidate.client.chat.completions.create(
        {
          model: candidate.model,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, ...imageInputs],
            },
          ],
          temperature: 0,
        },
        { timeout: 30_000 },
      );

      const content = response.choices[0]?.message?.content;

      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("returned an empty response.");
      }

      const rawParsed = rawExtractionResultSchema.parse(
        parseModelJson(content),
      );

      const events = rawParsed.events.flatMap((event) => {
        const result = extractedEventSchema.safeParse({
          ...event,
          title: event.title ?? "",
          start: event.start ?? "",
          location: event.location ?? "",
          notes: event.notes ?? "",
          allDay: event.allDay ?? undefined,
          confidence: event.confidence ?? undefined,
        });

        return result.success ? [result.data] : [];
      });

      return {
        summary: rawParsed.summary,
        timezone: rawParsed.timezone,
        events,
      };
    } catch (error) {
      failures.push(
        `${candidate.name} (${candidate.model}) ${preview(
          error instanceof Error ? error.message : String(error),
        )}`,
      );
    }
  }

  throw new Error(
    `All AI providers failed to extract events. ${failures.join(" | ")}`,
  );
}

export const isEventPast = (
  event: ExtractedEvent,
  referenceDate: Date = new Date(),
): boolean => {
  const effectiveEnd = event.end || event.start;

  if (event.allDay || isDateOnly(effectiveEnd)) {
    const endDate = isDateOnly(effectiveEnd)
      ? effectiveEnd
      : new Date(effectiveEnd).toISOString().slice(0, 10);
    const endOfDay = new Date(`${endDate}T23:59:59.999Z`);

    return !Number.isNaN(endOfDay.getTime()) && endOfDay < referenceDate;
  }

  const endTime = new Date(effectiveEnd);

  return !Number.isNaN(endTime.getTime()) && endTime < referenceDate;
};

export const normalizeCalendarEvent = (
  event: ExtractedEvent,
  timezone: string,
) => {
  if (event.allDay || isDateOnly(event.start)) {
    const startDate = isDateOnly(event.start)
      ? event.start
      : new Date(event.start).toISOString().slice(0, 10);
    const endDate =
      event.end && isDateOnly(event.end)
        ? event.end
        : addDaysToDateOnly(startDate, 1);

    return {
      start: { date: startDate },
      end: { date: endDate },
    };
  }

  const startDateTime = new Date(event.start).toISOString();
  const endDateTime = event.end
    ? new Date(event.end).toISOString()
    : addMinutes(startDateTime, 60);

  return {
    start: { dateTime: startDateTime, timeZone: timezone },
    end: { dateTime: endDateTime, timeZone: timezone },
  };
};

export async function syncEventsToGoogleCalendar(params: {
  events: ExtractedEvent[];
  timezone: string;
  calendarId: string;
  accessToken: string;
}): Promise<CalendarSyncResult[]> {
  const synced: CalendarSyncResult[] = [];

  for (const event of params.events) {
    if (!event.start) {
      continue;
    }

    const normalized = normalizeCalendarEvent(event, params.timezone);
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        params.calendarId,
      )}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: event.title,
          location: event.location || undefined,
          description: event.notes || undefined,
          ...normalized,
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Google Calendar rejected \"${event.title}\": ${response.status} ${details}`,
      );
    }

    const created = (await response.json()) as { htmlLink?: string };
    const start =
      "date" in normalized.start
        ? normalized.start.date
        : normalized.start.dateTime;
    const end =
      "date" in normalized.end ? normalized.end.date : normalized.end.dateTime;

    synced.push({
      title: event.title,
      htmlLink: created.htmlLink ?? null,
      start: start ?? "",
      end: end ?? "",
    });
  }

  return synced;
}
