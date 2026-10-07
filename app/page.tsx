"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { ingestEvents } from "./actions";
import { publishEvent, scheduleReminder } from "./platform-actions";
import type { AppState } from "@/lib/event-types";
import { formatEventWhen } from "@/lib/format";
import AuthModal from "./components/auth-modal";
import InfoModal from "./components/info-modal";
import { SITE } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";

const initialState: AppState = {
  status: "idle",
  message: "Drop images or paste notes to extract events.",
  summary: "",
  timezone: "UTC",
  extractedEvents: [],
  syncedEvents: [],
  isAuthenticated: false,
  calendarConnected: false,
  remainingExtractions: null,
  limitReached: false,
};

const primaryButton =
  "inline-flex h-12 min-w-[85px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";

const secondaryButton =
  "inline-flex h-12 min-w-[85px] items-center justify-center gap-2 rounded-full bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted cursor-pointer";

export default function Home() {
  const [state, formAction, pending] = useActionState(
    ingestEvents,
    initialState,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [session, setSession] = useState<Session | null>(null);
  const [hasInputText, setHasInputText] = useState(false);
  const [eventAction, setEventAction] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoGlow, setLogoGlow] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);

  // Advanced credentials, edited on the profile page and stored locally.
  const [groqKey, setGroqKey] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [calendarId, setCalendarId] = useState("primary");
  const [accessToken, setAccessToken] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const logoClicks = useRef(0);
  const logoResetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const logoGlowTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setGroqKey(localStorage.getItem("loopin_groq_key") || "");
      setTimezone(localStorage.getItem("loopin_timezone") || "UTC");
      setCalendarId(localStorage.getItem("loopin_calendar_id") || "primary");
      setAccessToken(localStorage.getItem("loopin_access_token") || "");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Track the Supabase auth session.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setSessionLoaded(true);
        }
      })
      .catch(() => {
        if (active) setSessionLoaded(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          console.error("Service worker registration failed:", err),
        );
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowInfoModal(false);
        setShowAuthModal(false);
        setMenuOpen(false);
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Close the account menu when clicking anywhere outside it.
  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClick(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountMenuOpen]);

  // Clear the easter-egg timers on unmount.
  useEffect(() => {
    return () => {
      if (logoResetTimer.current) clearTimeout(logoResetTimer.current);
      if (logoGlowTimer.current) clearTimeout(logoGlowTimer.current);
    };
  }, []);

  const syncFiles = (nextFiles: File[]) => {
    const limited = nextFiles.slice(0, 3);
    setFiles(limited);
    filesRef.current = limited;

    if (inputRef.current) {
      const transfer = new DataTransfer();
      limited.forEach((file) => transfer.items.add(file));
      inputRef.current.files = transfer.files;
    }
  };

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;

      const pastedImages: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) pastedImages.push(file);
        }
      }

      if (pastedImages.length > 0) {
        event.preventDefault();
        syncFiles([...filesRef.current, ...pastedImages]);
      }
    }

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    syncFiles(
      Array.from(event.dataTransfer.files).filter((file) =>
        file.type.startsWith("image/"),
      ),
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    syncFiles(Array.from(event.currentTarget.files ?? []));
  };

  const removeFile = (indexToRemove: number) => {
    syncFiles(files.filter((_, idx) => idx !== indexToRemove));
  };

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const signOut = async () => {
    setAccountMenuOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  // Easter egg: three quick taps on the logo makes it glow rainbow.
  const handleLogoClick = () => {
    logoClicks.current += 1;
    if (logoResetTimer.current) clearTimeout(logoResetTimer.current);
    if (logoClicks.current >= 3) {
      logoClicks.current = 0;
      setLogoGlow(true);
      if (logoGlowTimer.current) clearTimeout(logoGlowTimer.current);
      logoGlowTimer.current = setTimeout(() => setLogoGlow(false), 4000);
      return;
    }
    logoResetTimer.current = setTimeout(() => {
      logoClicks.current = 0;
    }, 700);
  };

  const handleAuthed = () => {
    setShowAuthModal(false);
    // Re-run extraction now that we're signed in so results reveal and sync.
    setTimeout(() => formRef.current?.requestSubmit(), 50);
  };

  const handlePublish = async (event: {
    title: string;
    start: string;
    end?: string | null;
    location?: string;
    notes?: string;
  }) => {
    const key = `${event.title}-${event.start}`;
    const result = await publishEvent(event);
    setEventAction((prev) => ({
      ...prev,
      [key]:
        "path" in result
          ? `Published → ${result.path}`
          : `Could not publish (${result.error})`,
    }));
  };

  const handleRemind = async (event: { title: string; start: string }) => {
    const key = `${event.title}-${event.start}`;
    const result = await scheduleReminder(event, 30);
    setEventAction((prev) => ({
      ...prev,
      [key]:
        "sendAt" in result
          ? "Reminder set for 30 minutes before"
          : result.error === "too_late"
            ? "That event is too soon to remind"
            : `Could not set reminder (${result.error})`,
    }));
  };

  const isAuthed = Boolean(session);
  const needsAuth = !isAuthed && state.extractedEvents.length > 0;
  const eventCount = state.extractedEvents.length;
  const initials = (session?.user?.email ?? "?").slice(0, 1).toUpperCase();
  const avatarMeta = (session?.user?.user_metadata ?? {}) as {
    avatar_url?: string;
    avatar_emoji?: string;
    avatar_color?: string;
  };
  const photoUrl =
    typeof avatarMeta.avatar_url === "string" && avatarMeta.avatar_url
      ? avatarMeta.avatar_url
      : null;

  const isTransitioned =
    state.status !== "idle" || pending || files.length > 0 || hasInputText;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <form
        ref={formRef}
        action={formAction}
        className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6 2xl:max-w-6xl"
      >
        {/* Advanced credentials (edited on the profile page). */}
        <input type="hidden" name="groqApiKey" value={groqKey} />
        <input type="hidden" name="timezone" value={timezone} />
        <input type="hidden" name="calendarId" value={calendarId} />
        <input type="hidden" name="googleAccessToken" value={accessToken} />

        {/* Top utility bar */}
        <header className="relative flex items-center justify-between py-4">
          <Link
            href="/"
            onClick={handleLogoClick}
            className={`flex items-baseline gap-2 py-3 -my-3 ${logoGlow ? "animate-logo-rainbow" : ""}`}
          >
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="hidden h-11 items-center rounded-full px-4 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground cursor-pointer sm:flex"
            >
              How it works
            </button>
            <Link
              href="/about"
              className="hidden h-11 items-center rounded-full px-4 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground sm:flex"
            >
              About
            </Link>
            <Link
              href="/pricing"
              className="hidden h-11 items-center rounded-full px-4 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground sm:flex"
            >
              Pricing
            </Link>
            {!sessionLoaded ? (
              <div
                className="h-11 w-11 animate-pulse rounded-full bg-surface-muted"
                aria-hidden
              />
            ) : session ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  aria-label="Account menu"
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="menu"
                  className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-medium cursor-pointer transition-colors ${
                    avatarMeta.avatar_color
                      ? "text-white"
                      : "bg-primary text-on-primary hover:bg-primary-hover"
                  }`}
                  style={
                    avatarMeta.avatar_color
                      ? { backgroundColor: avatarMeta.avatar_color }
                      : undefined
                  }
                >
                  {avatarMeta.avatar_emoji ? (
                    <span className="text-base leading-none">
                      {avatarMeta.avatar_emoji}
                    </span>
                  ) : photoUrl && failedPhotoUrl !== photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt=""
                      onError={() => setFailedPhotoUrl(photoUrl)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </button>
                {accountMenuOpen && (
                  <div
                    role="menu"
                    className="animate-scale-in absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-border bg-surface p-2 shadow-lg"
                  >
                    <Link
                      role="menuitem"
                      href="/profile"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      Account
                    </Link>
                    <Link
                      role="menuitem"
                      href="/profile#picture"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      Profile picture
                    </Link>
                    <Link
                      role="menuitem"
                      href="/settings"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                      Settings
                    </Link>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={signOut}
                      className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-error transition-colors hover:bg-error-soft cursor-pointer"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openAuth("signup")}
                className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
              >
                Sign in
              </button>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="flex h-11 w-11 items-center justify-center rounded-full text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground cursor-pointer sm:hidden"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>
          </nav>

          {/* Mobile menu (shown below the sm breakpoint) */}
          {menuOpen && (
            <div
              id="mobile-menu"
              className="absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-surface p-2 shadow-lg sm:hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowInfoModal(true);
                }}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground cursor-pointer"
              >
                How it works
              </button>
              <Link
                href="/about"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                About
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                Pricing
              </Link>
              <div className="my-1 border-t border-border" />
              {session ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground"
                  >
                    Settings
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openAuth("signin");
                  }}
                  className="flex min-h-11 w-full items-center rounded-md px-3 text-sm font-medium text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground cursor-pointer"
                >
                  Sign in
                </button>
              )}
            </div>
          )}
        </header>

        {/* Main content */}
        <div
          className={`flex flex-1 flex-col transition-all duration-500 ease-in-out ${
            isTransitioned ? "justify-start pt-4" : "justify-center"
          }`}
        >
          {/* Search-engine-style H1 for SEO/a11y — the landing stays minimal. */}
          <h1 className="sr-only">
            Turn screenshots and notes into calendar events with Loopin
          </h1>

          {/* Results (gated behind signup when anonymous) */}
          <div className="relative">
            <div
              className={`w-full space-y-6 transition-all duration-500 ease-in-out ${
                isTransitioned
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none h-0 translate-y-4 overflow-hidden opacity-0"
              } ${needsAuth ? "pointer-events-none blur-[6px] select-none mx-auto max-w-2xl 2xl:max-w-3xl" : ""}`}
              aria-hidden={needsAuth}
            >
              {state.status !== "idle" && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`flex gap-3 rounded-lg border p-4 text-sm ${
                    state.status === "success"
                      ? "border-primary-border bg-primary-soft text-primary"
                      : "border-error-border bg-error-soft text-error"
                  }`}
                >
                  {state.status === "success" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="flex-shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m15 9-6 6" />
                      <path d="m9 9 6 6" />
                    </svg>
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {state.status === "success"
                        ? "Events extracted"
                        : state.limitReached
                          ? "Monthly limit reached"
                          : "Something went wrong"}
                    </p>
                    <p className="text-xs leading-relaxed text-foreground">
                      {state.message}
                    </p>
                    {state.limitReached && (
                      <Link
                        href="/pricing"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline"
                      >
                        See Pro plans
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {pending && state.extractedEvents.length === 0 && (
                <div className="space-y-4" role="status">
                  <span className="sr-only">Extracting events…</span>
                  <h2 className="font-display text-xs font-medium tracking-wide text-tertiary uppercase">
                    Extracting events
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        aria-hidden
                        className="rounded-lg border border-border bg-surface p-4"
                      >
                        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" />
                        <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-surface-muted" />
                        <div className="mt-4 space-y-2">
                          <div className="h-3 w-1/2 animate-pulse rounded bg-surface-muted" />
                          <div className="h-3 w-3/5 animate-pulse rounded bg-surface-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {state.extractedEvents.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xs font-medium tracking-wide text-tertiary uppercase">
                    Extracted events
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {state.extractedEvents.map((event) => (
                      <article
                        key={`${event.title}-${event.start}`}
                        className={`rounded-lg border bg-surface p-4 transition-colors ${
                          event.isPast
                            ? "border-error-border opacity-75"
                            : "border-border hover:border-border-strong"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-[15px] font-medium text-foreground">
                            {event.title}
                          </h3>
                          {event.isPast ? (
                            <span className="rounded-full bg-error-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-error">
                              Deadline passed
                            </span>
                          ) : (
                            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary">
                              {Math.round(event.confidence * 100)}% match
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-tertiary">
                          <div className="flex items-center gap-2">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                width="18"
                                height="18"
                                x="3"
                                y="4"
                                rx="2"
                                ry="2"
                              />
                              <line x1="16" x2="16" y1="2" y2="6" />
                              <line x1="8" x2="8" y1="2" y2="6" />
                              <line x1="3" x2="21" y1="10" y2="10" />
                            </svg>
                            <span>
                              {formatEventWhen(
                                event.start,
                                event.end,
                                state.timezone,
                              )}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                          {event.notes && (
                            <p className="mt-2 border-t border-border pt-2 text-xs leading-normal text-tertiary">
                              {event.notes}
                            </p>
                          )}
                        </div>

                        {isAuthed && (
                          <div className="mt-3 border-t border-border pt-3">
                            <div className="flex flex-wrap items-center gap-4">
                              <button
                                type="button"
                                onClick={() => handlePublish(event)}
                                className="text-xs font-medium text-primary hover:underline cursor-pointer"
                              >
                                Publish page
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemind(event)}
                                className="text-xs font-medium text-primary hover:underline cursor-pointer"
                              >
                                Remind me
                              </button>
                            </div>
                            {eventAction[`${event.title}-${event.start}`] && (
                              <p className="mt-1.5 text-xs text-tertiary">
                                {eventAction[`${event.title}-${event.start}`]}
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {state.syncedEvents.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xs font-medium tracking-wide text-tertiary uppercase">
                    Synced to Google Calendar
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {state.syncedEvents.map((event) => (
                      <article
                        key={`${event.title}-${event.start}`}
                        className="rounded-lg border border-primary-border bg-primary-soft p-4"
                      >
                        <h3 className="font-display text-[15px] font-medium text-foreground">
                          {event.title}
                        </h3>
                        <p className="mt-1 text-xs text-tertiary">
                          {formatEventWhen(
                            event.start,
                            event.end,
                            state.timezone,
                          )}
                        </p>
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                          >
                            <span>Open calendar</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M15 3h6v6" />
                              <path d="M10 14 21 3" />
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            </svg>
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lead-gen gate overlay — in flow on small screens (so it never
                covers the input), centered over the blurred preview on sm+. */}
            {needsAuth && (
              <div className="relative z-0 flex items-center justify-center py-6 sm:absolute sm:inset-0 sm:z-30 sm:px-4 sm:py-4">
                <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <h3 className="font-display text-lg font-medium text-foreground">
                    Unlock your {eventCount} extracted event
                    {eventCount === 1 ? "" : "s"}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-tertiary">
                    Create a free account to reveal the results, auto-sync to
                    Google Calendar, and keep your event history. Includes 3
                    free extractions every month.
                  </p>
                  <button
                    type="button"
                    onClick={() => openAuth("signup")}
                    className={`mt-4 w-full ${primaryButton}`}
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth("signin")}
                    className={`mt-2 w-full ${secondaryButton}`}
                  >
                    I already have an account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search / input module */}
          <div
            className={`z-20 w-full transition-all duration-500 ease-in-out ${
              isTransitioned
                ? needsAuth
                  ? "sm:sticky sm:bottom-0 -mx-4 bg-background/90 px-4 pt-4 pb-6 backdrop-blur-sm sm:-mx-6 sm:px-6"
                  : "sticky bottom-0 -mx-4 bg-background/90 px-4 pt-4 pb-6 backdrop-blur-sm sm:-mx-6 sm:px-6"
                : "mx-auto max-w-2xl 2xl:max-w-3xl"
            }`}
          >
            <div
              className={
                isTransitioned ? "mx-auto max-w-3xl 2xl:max-w-4xl" : "w-full"
              }
            >
              {/* Brand logo — hidden once the user starts interacting. */}
              <div
                aria-hidden={isTransitioned}
                className={`flex justify-center transition-all duration-500 ease-in-out ${
                  isTransitioned
                    ? "pointer-events-none max-h-0 overflow-hidden opacity-0"
                    : "mb-8 max-h-40 opacity-100"
                }`}
              >
                <span
                  onClick={handleLogoClick}
                  className={`flex cursor-pointer items-center gap-3 ${logoGlow ? "animate-logo-rainbow" : ""}`}
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z" />
                    </svg>
                  </span>
                  <span className="font-display text-[44px] leading-none font-bold tracking-tight text-foreground">
                    loopin
                  </span>
                </span>
              </div>
              <section
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="group relative rounded-[24px] border border-border bg-surface transition-colors focus-within:border-border-strong focus-within:shadow-[var(--search-shadow)]"
              >
                <div className="flex items-start gap-3 px-5 py-4">
                  <svg
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 flex-shrink-0 text-tertiary"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>

                  <textarea
                    name="sourceText"
                    aria-label="Paste event details or drop an image"
                    rows={isTransitioned ? 3 : 2}
                    onChange={(e) =>
                      setHasInputText(e.target.value.trim().length > 0)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (e.currentTarget.value.trim().length > 0) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    className="w-full resize-none border-0 bg-transparent py-0.5 text-base leading-relaxed text-foreground outline-none placeholder:text-tertiary focus:outline-none"
                    placeholder="Paste details or drop an image…"
                  />

                  <label
                    className="flex h-9 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-tertiary transition-colors hover:bg-surface-muted hover:text-primary"
                    title="Upload image"
                  >
                    <input
                      ref={inputRef}
                      id="images"
                      name="images"
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handleFileChange}
                    />
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-5 pb-4">
                    {files.map((file, idx) => (
                      <div
                        key={`${file.name}-${file.lastModified}`}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-surface-muted py-1 pr-1.5 pl-3 text-xs font-medium text-foreground"
                      >
                        <span className="max-w-40 truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="rounded-full p-1 text-tertiary transition-colors hover:bg-surface hover:text-foreground cursor-pointer"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className={primaryButton}
                >
                  {pending ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin text-on-primary"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Syncing…</span>
                    </>
                  ) : (
                    <>
                      <span>Extract &amp; sync</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-col items-start gap-1 py-4 text-sm text-tertiary sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-5">
          <div className="flex flex-wrap items-center gap-x-5">
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/about"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              About
            </Link>
            {session && (
              <>
                <Link
                  href="/profile"
                  className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
                >
                  Settings
                </Link>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5">
            <span>© 2026 loopin</span>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Support
            </a>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </footer>
      </form>

      {/* Auth modal */}
      {showAuthModal && (
        <AuthModal
          initialMode={authMode}
          headline={needsAuth ? `Unlock your ${eventCount} events` : undefined}
          description={
            needsAuth
              ? "Sign up free to reveal your results and sync them to Google Calendar."
              : undefined
          }
          onClose={() => setShowAuthModal(false)}
          onAuthed={handleAuthed}
        />
      )}

      {/* Info modal */}
      {showInfoModal && (
        <InfoModal
          onClose={() => setShowInfoModal(false)}
          onGetStarted={() => openAuth("signup")}
        />
      )}
    </main>
  );
}
