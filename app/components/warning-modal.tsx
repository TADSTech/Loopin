"use client";

import { useEffect, type ReactElement } from "react";

export type WarningKind = "rate_limited" | "banned" | "info";

const COPY: Record<
  WarningKind,
  { title: string; tone: string; badge: string; icon: ReactElement }
> = {
  rate_limited: {
    title: "Slow down a moment",
    tone: "border-primary-border bg-primary-soft text-primary",
    badge: "bg-primary-soft text-primary",
    icon: (
      <svg
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  banned: {
    title: "Access paused",
    tone: "border-error-border bg-error-soft text-error",
    badge: "bg-error-soft text-error",
    icon: (
      <svg
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
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </svg>
    ),
  },
  info: {
    title: "Heads up",
    tone: "border-border bg-surface-muted text-foreground",
    badge: "bg-surface-muted text-foreground",
    icon: (
      <svg
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
};

/**
 * In-app warning dialog shown when a request is rate-limited or the caller's
 * IP has been banned. Mirrors the styling conventions of the existing modals.
 */
export default function WarningModal({
  kind,
  message,
  retryAfter,
  onClose,
}: {
  kind: WarningKind;
  message?: string;
  retryAfter?: number;
  onClose: () => void;
}) {
  const copy = COPY[kind];

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

  const fallback =
    kind === "banned"
      ? "Too many automated requests were detected from this network. Access is temporarily paused and will lift on its own."
      : retryAfter
        ? `You're sending requests too quickly. Please wait about ${retryAfter}s and try again.`
        : "You're sending requests too quickly. Please wait a moment and try again.";

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="warning-modal-title"
        aria-describedby="warning-modal-desc"
        onClick={(event) => event.stopPropagation()}
        className="animate-scale-in w-full max-w-md rounded-lg border border-border bg-surface p-6 text-center"
      >
        <div
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${copy.badge}`}
        >
          {copy.icon}
        </div>
        <h2
          id="warning-modal-title"
          className="font-display text-lg font-medium text-foreground"
        >
          {copy.title}
        </h2>
        <p
          id="warning-modal-desc"
          className="mt-2 text-sm leading-relaxed text-tertiary"
        >
          {message || fallback}
          {kind === "rate_limited" && retryAfter ? (
            <>
              {" "}
              Try again in about <strong>{retryAfter}s</strong>.
            </>
          ) : null}
        </p>
        <p className="mt-3 text-xs text-tertiary">
          Think this is a mistake?{" "}
          <a
            href="mailto:motrenewed@gmail.com"
            className="font-medium text-primary hover:underline"
          >
            Contact support
          </a>
          .
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
