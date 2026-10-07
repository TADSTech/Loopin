/** Free plan: 3 extractions per calendar month. */
export const FREE_MONTHLY_EXTRACTION_LIMIT = 3;

export type PlanId = "free" | "pro" | "team";

/** ISO timestamp for the first instant of the current month (UTC). */
export function monthStartIso(reference: Date = new Date()): string {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  ).toISOString();
}
