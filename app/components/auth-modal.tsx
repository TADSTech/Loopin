"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

const BENEFITS = [
  "3 free AI extractions every month",
  "One-click Google Calendar sync",
  "Saved event history you can revisit",
  "No API keys or setup required",
];

export default function AuthModal({
  initialMode = "signup",
  headline,
  description,
  onClose,
  onAuthed,
}: {
  initialMode?: AuthMode;
  headline?: string;
  description?: string;
  onClose: () => void;
  onAuthed?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Escape to close + lock background scroll while the dialog is open.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const continueWithGoogle = async () => {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
        // One-click setup: request Calendar access during Google sign-in.
        scopes: "https://www.googleapis.com/auth/calendar",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          onAuthed?.();
          onClose();
        } else {
          setNotice(
            "Check your email to confirm your account, then sign in here.",
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthed?.();
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="animate-scale-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-medium text-foreground"
            >
              {showEmail
                ? mode === "signup"
                  ? "Free & self-host sign up"
                  : "Free & self-host sign in"
                : (headline ?? "Continue with Google")}
            </h2>
            <p className="text-sm leading-relaxed text-tertiary">
              {showEmail
                ? "Email & password is for the free tier and self-hosters."
                : (description ??
                  "The fastest way to extract events and sync them to your calendar.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full p-1 text-tertiary transition-colors hover:bg-surface-muted hover:text-foreground cursor-pointer"
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
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {!showEmail ? (
          <div key="google" className="animate-fade-in">
            <ul className="mt-5 space-y-2">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="flex-shrink-0 text-primary"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {benefit}
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-4 rounded-md bg-error-soft px-3 py-2 text-xs text-error">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-border bg-surface text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
                />
              </svg>
              Continue with Google
            </button>

            <p className="mt-5 text-center text-xs text-tertiary">
              Self-hosting or using your own keys?{" "}
              <button
                type="button"
                onClick={() => {
                  setShowEmail(true);
                  setError("");
                  setNotice("");
                }}
                className="inline-flex min-h-11 min-w-11 justify-center items-center font-medium text-primary hover:underline cursor-pointer"
              >
                Sign in with email
              </button>
            </p>
          </div>
        ) : (
          <div key="email" className="animate-fade-in">
            <form onSubmit={submit} className="mt-5 space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium tracking-wide text-tertiary uppercase">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium tracking-wide text-tertiary uppercase">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-tertiary focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="At least 6 characters"
                />
              </div>

              {error && (
                <p className="rounded-md bg-error-soft px-3 py-2 text-xs text-error">
                  {error}
                </p>
              )}
              {notice && (
                <p className="rounded-md bg-primary-soft px-3 py-2 text-xs text-primary">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create free account"
                    : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-tertiary">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError("");
                  setNotice("");
                }}
                className="inline-flex min-h-11 min-w-11 justify-center items-center font-medium text-primary hover:underline cursor-pointer"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>

            <p className="mt-2 text-center text-xs text-tertiary">
              <button
                type="button"
                onClick={() => {
                  setShowEmail(false);
                  setError("");
                  setNotice("");
                }}
                className="inline-flex min-h-11 min-w-11 justify-center items-center font-medium text-primary hover:underline cursor-pointer"
              >
                ← Back to Google sign-in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
