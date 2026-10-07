"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

const fieldInput =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary focus:border-primary focus:ring-1 focus:ring-primary";

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [groqKey, setGroqKey] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [calendarId, setCalendarId] = useState("primary");
  const [accessToken, setAccessToken] = useState("");
  const [saved, setSaved] = useState(false);

  // Settings are account-only — bounce signed-out visitors to the app.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (!data.session) {
          router.replace("/");
          return;
        }
        setSession(data.session);
      })
      .catch(() => router.replace("/"));
    return () => {
      active = false;
    };
  }, [router]);

  // Credentials live in this browser only.
  useEffect(() => {
    const timer = setTimeout(() => {
      setGroqKey(localStorage.getItem("loopin_groq_key") || "");
      setTimezone(localStorage.getItem("loopin_timezone") || "UTC");
      setCalendarId(localStorage.getItem("loopin_calendar_id") || "primary");
      setAccessToken(localStorage.getItem("loopin_access_token") || "");
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const saveAdvanced = () => {
    localStorage.setItem("loopin_groq_key", groqKey);
    localStorage.setItem("loopin_timezone", timezone);
    localStorage.setItem("loopin_calendar_id", calendarId);
    localStorage.setItem("loopin_access_token", accessToken);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ready = Boolean(session) && hydrated;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/"
            className="flex h-10 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Back to app
          </Link>
        </header>

        <div className="flex-1 space-y-5 py-6">
          <div>
            <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="mt-1 text-sm text-tertiary">
              Bring your own credentials for extraction and calendar access.
            </p>
          </div>

          {!ready ? (
            <section
              aria-hidden
              className="rounded-lg border border-border bg-surface p-5"
            >
              <div className="h-3 w-56 animate-pulse rounded bg-surface-muted" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
                    <div className="h-9 w-full animate-pulse rounded-md bg-surface-muted" />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-border bg-surface p-5">
              <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
                Advanced (bring your own keys)
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-tertiary">
                Optional. Use these if you&apos;re on the free tier or
                self-hosting and want extraction to run on your own credentials.
                Values are stored only in this browser. Signed in with Google?
                Your calendar connection is managed on the Profile page.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium tracking-wide text-tertiary uppercase">
                    Groq API key
                  </label>
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    className={fieldInput}
                    placeholder="gsk_..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium tracking-wide text-tertiary uppercase">
                    Timezone
                  </label>
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={fieldInput}
                    placeholder="e.g. Africa/Lagos"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium tracking-wide text-tertiary uppercase">
                    Calendar ID
                  </label>
                  <input
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    className={fieldInput}
                    placeholder="primary or custom ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium tracking-wide text-tertiary uppercase">
                    Access token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className={fieldInput}
                    placeholder="OAuth access token"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveAdvanced}
                  className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
                >
                  Save
                </button>
                {saved && (
                  <span className="animate-fade-in text-sm text-primary">
                    Saved
                  </span>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-tertiary">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/profile"
              className="transition-colors hover:text-foreground"
            >
              Profile
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground">
              Home
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
