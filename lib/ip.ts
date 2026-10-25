type HeadersLike = { get(name: string): string | null };

/**
 * Best-effort client IP extraction. On Vercel the real client IP is the first
 * hop of `x-forwarded-for`; we fall back to `x-real-ip` and finally to an empty
 * string (local dev / tests) so callers can skip enforcement when unknown.
 * Accepts a `Request`/`NextRequest` or a Next headers() object.
 */
export function clientIp(source: { headers: HeadersLike }): string {
  const forwarded = source.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return source.headers.get("x-real-ip")?.trim() ?? "";
}
