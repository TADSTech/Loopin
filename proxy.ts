import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { clientIp } from "@/lib/ip";
import { getBanStatus } from "@/lib/rate-limit";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Static response served to a banned IP. Self-contained (inline styles) so it
 * renders even though the request is short-circuited before the app shell.
 */
function bannedResponse(retryAfter: number): NextResponse {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Temporarily blocked — Loopin</title>
    <style>
      :root { color-scheme: light dark; }
      body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
        display:flex; min-height:100dvh; align-items:center; justify-content:center; padding:24px;
        background:#f6f7f9; color:#1a1d21; }
      .card { max-width:440px; text-align:center; border:1px solid #e3e7ec; background:#fff;
        border-radius:16px; padding:36px 32px; box-shadow:0 1px 2px rgba(16,24,40,.05); }
      .badge { display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px;
        border-radius:999px; background:#fef3f2; color:#b42318; margin-bottom:16px; }
      h1 { font-size:22px; margin:0 0 8px; letter-spacing:-0.02em; }
      p { color:#5b6471; font-size:14px; line-height:1.6; margin:0 0 8px; }
      a { color:#175cd3; text-decoration:none; font-weight:600; }
      a:hover { text-decoration:underline; }
    </style>
  </head>
  <body>
    <main class="card" role="alert">
      <div class="badge" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v4"/><path d="M12 17h.01"/>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      </div>
      <h1>Access temporarily blocked</h1>
      <p>Too many automated requests were detected from this network, so access has been paused as a safeguard.</p>
      <p>This block lifts automatically in about <strong>${minutes} minute${minutes === 1 ? "" : "s"}</strong>. If you believe this is a mistake, contact
        <a href="mailto:motrenewed@gmail.com">support</a>.</p>
    </main>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "retry-after": String(retryAfter),
    },
  });
}

/**
 * Next.js 16 middleware. Enforces active IP bans across the whole app (so a
 * caller that tripped a rate limit can't bypass it by reloading pages or
 * hitting other endpoints), then refreshes the Supabase auth session.
 */
export async function proxy(request: NextRequest) {
  const ip = clientIp(request);
  if (ip) {
    const ban = getBanStatus(`ip:${ip}`);
    if (ban.banned) {
      return bannedResponse(ban.retryAfter);
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
