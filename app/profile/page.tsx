"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getAccountSummary, type AccountSummary } from "../actions";
import { createClient } from "@/lib/supabase/client";

const AVATAR_COLORS = [
  "#db4437", // red
  "#0f9d58", // green
  "#ab47bc", // purple
  "#e91e63", // pink
  "#00838f", // teal
  "#e64a19", // orange
  "#5f6368", // gray
  "#0b57d0", // blue
];

const AVATAR_EMOJIS = [
  "🦊",
  "🐼",
  "🐸",
  "🚀",
  "🎨",
  "🎧",
  "⚡",
  "🌊",
  "🔥",
  "🌈",
  "⭐",
  "🎵",
  "🍕",
  "💻",
  "🤖",
  "🎮",
  "🌻",
  "🐙",
];

const emojiTile =
  "flex h-10 w-10 items-center justify-center rounded-full text-lg transition-transform hover:scale-110 cursor-pointer";
const emojiTileSelected =
  " ring-2 ring-foreground ring-offset-2 ring-offset-surface";

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [avatarColor, setAvatarColor] = useState("#0b57d0");
  const [avatarStatus, setAvatarStatus] = useState<"saved" | "error" | null>(
    null,
  );
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  // Redirect away when not signed in — the profile is account-only.
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
        const meta = data.session.user.user_metadata ?? {};
        setAvatarEmoji(
          typeof meta.avatar_emoji === "string" ? meta.avatar_emoji : "",
        );
        setAvatarColor(
          typeof meta.avatar_color === "string" ? meta.avatar_color : "#0b57d0",
        );
      })
      .catch(() => router.replace("/"));
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    getAccountSummary()
      .then((data) => {
        if (active) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  const isGoogleUser = Boolean(
    session?.user.identities?.some(
      (identity) => identity.provider === "google",
    ) || session?.user.app_metadata?.provider === "google",
  );

  const connectGoogleCalendar = async () => {
    if (!isGoogleUser) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const saveAvatar = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { avatar_emoji: avatarEmoji, avatar_color: avatarColor },
    });
    if (error) {
      setAvatarStatus("error");
      setTimeout(() => setAvatarStatus(null), 3000);
      return;
    }
    if (session) {
      setSession({
        ...session,
        user: {
          ...session.user,
          user_metadata: {
            ...session.user.user_metadata,
            avatar_emoji: avatarEmoji,
            avatar_color: avatarColor,
          },
        },
      });
    }
    setAvatarStatus("saved");
    setTimeout(() => setAvatarStatus(null), 2000);
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  };

  const rawAvatarUrl = session?.user.user_metadata?.avatar_url;
  const photoUrl =
    typeof rawAvatarUrl === "string" && rawAvatarUrl ? rawAvatarUrl : null;

  const isPro = summary?.plan === "pro" || summary?.plan === "team";
  const used = summary?.used ?? 0;
  const limit = summary?.limit ?? null;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

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
              Your profile
            </h1>
            <p className="mt-1 text-sm text-tertiary">
              Manage your account, calendar connection, and usage.
            </p>
          </div>

          {/* Account */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Account
            </h2>
            {session ? (
              <>
                <p className="mt-3 text-sm font-medium text-foreground">
                  {session.user.email}
                </p>
                <p className="mt-0.5 text-xs text-tertiary">
                  Signed in{summary ? ` · ${summary.plan} plan` : ""}
                </p>
              </>
            ) : (
              <div className="mt-3 space-y-2" role="status">
                <span className="sr-only">Loading account…</span>
                <div className="h-4 w-44 animate-pulse rounded bg-surface-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-surface-muted" />
              </div>
            )}
            <button
              type="button"
              onClick={signOut}
              className="mt-4 inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted cursor-pointer"
            >
              Sign out
            </button>
          </section>

          {/* Profile picture */}
          <section
            id="picture"
            className="scroll-mt-4 rounded-lg border border-border bg-surface p-5"
          >
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Profile picture
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-tertiary">
              Pick an emoji and a color for your avatar — no more blue initials.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-medium text-white"
                style={{ backgroundColor: avatarColor }}
              >
                {avatarEmoji ? (
                  <span className="text-2xl leading-none">{avatarEmoji}</span>
                ) : photoUrl && failedPhotoUrl !== photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoUrl}
                    alt=""
                    onError={() => setFailedPhotoUrl(photoUrl)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (session?.user.email ?? "?").slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    aria-label={`Avatar color ${color}`}
                    aria-pressed={avatarColor === color}
                    className={`h-8 w-8 rounded-full cursor-pointer transition-transform hover:scale-110 ${
                      avatarColor === color
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAvatarEmoji("")}
                aria-label="Default avatar (initial or photo)"
                aria-pressed={avatarEmoji === ""}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-tertiary transition-transform hover:scale-110 cursor-pointer bg-surface-muted ${
                  avatarEmoji === "" ? emojiTileSelected : ""
                }`}
              >
                Aa
              </button>
              {AVATAR_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarEmoji(emoji)}
                  aria-label={`Avatar emoji ${emoji}`}
                  aria-pressed={avatarEmoji === emoji}
                  className={`${emojiTile} bg-surface-muted ${
                    avatarEmoji === emoji ? emojiTileSelected : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={saveAvatar}
                className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
              >
                Save picture
              </button>
              {avatarStatus === "saved" && (
                <span className="animate-fade-in text-sm text-primary">
                  Saved
                </span>
              )}
              {avatarStatus === "error" && (
                <span className="animate-fade-in text-sm text-error">
                  Could not save — try again
                </span>
              )}
            </div>
          </section>

          {/* Usage & plan */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
                Usage this month
              </h2>
              {!summary ? (
                <span
                  className="h-5 w-14 animate-pulse rounded-full bg-surface-muted"
                  aria-hidden
                />
              ) : isPro ? (
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {summary.plan}
                </span>
              ) : (
                <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-tertiary">
                  Free
                </span>
              )}
            </div>

            {loading ? (
              <div className="mt-3 space-y-2" role="status">
                <span className="sr-only">Loading usage…</span>
                <div className="h-4 w-48 animate-pulse rounded bg-surface-muted" />
                <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-muted" />
              </div>
            ) : isPro ? (
              <p className="mt-3 text-sm text-foreground">
                Unlimited extractions. Nice.
              </p>
            ) : (
              <>
                <p className="mt-3 text-sm text-foreground">
                  <span className="font-medium">{used}</span> of{" "}
                  <span className="font-medium">{limit}</span> free extractions
                  used
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-tertiary">
                  Free accounts reset on the 1st of each month.
                </p>
                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
                >
                  Upgrade to Pro
                </Link>
              </>
            )}
          </section>

          {/* Google Calendar */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Google Calendar
            </h2>
            {isGoogleUser ? (
              <>
                <p className="mt-3 text-sm text-foreground">
                  {summary?.calendarConnected
                    ? "Connected — new events sync automatically."
                    : "Not connected yet."}
                </p>
                <button
                  type="button"
                  onClick={connectGoogleCalendar}
                  className={`mt-4 inline-flex h-11 items-center rounded-full px-6 text-sm font-medium transition-colors cursor-pointer ${
                    summary?.calendarConnected
                      ? "border border-border text-foreground hover:bg-surface-muted"
                      : "bg-primary text-on-primary hover:bg-primary-hover"
                  }`}
                >
                  {summary?.calendarConnected
                    ? "Reconnect Google Calendar"
                    : "Connect Google Calendar"}
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-foreground">
                  {summary?.calendarConnected
                    ? "A calendar connection exists, but reconnecting requires signing in with Google."
                    : "Signed in with email — calendar access runs on your own credentials."}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-tertiary">
                  Loopin&apos;s Google Calendar connection is only for accounts
                  signed in with Google. Paste your own access token and
                  Calendar ID in Settings instead, and extractions will read
                  your calendar with those.
                </p>
                <Link
                  href="/settings"
                  className="mt-4 inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
                >
                  Open Settings
                </Link>
              </>
            )}
          </section>

          {/* Platform tools */}
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-xs font-medium tracking-wide text-tertiary uppercase">
              Platform tools
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/developers"
                className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                API &amp; webhooks
              </Link>
              <Link
                href="/workspaces"
                className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
              >
                Shared calendars
              </Link>
            </div>
          </section>
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
              href="/settings"
              className="transition-colors hover:text-foreground"
            >
              Settings
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
