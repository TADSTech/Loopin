"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "product" | "free";

const PRODUCT_STEPS = [
  {
    title: "Create your free account",
    body: "Sign up with email or Google in seconds. Your account unlocks unlimited extractions, saved history, and automatic sync.",
  },
  {
    title: "Connect Google Calendar in one click",
    body: "Open your account menu and connect Google Calendar. We store the connection securely and refresh it automatically — no tokens to copy or paste.",
  },
  {
    title: "Drop events, get them synced",
    body: "Paste messy notes, or drop screenshots and flyers. Loopin's AI extracts every event and syncs it straight to your calendar.",
  },
  {
    title: "Revisit everything anytime",
    body: "Every extraction is saved to your history, so nothing gets lost between meetings, flights, or deadlines.",
  },
];

const FREE_STEPS = [
  {
    title: "Add your own Groq API key",
    body: "Create a key at console.groq.com and paste it under Settings → Free tier. Extraction runs on your key, your cost.",
  },
  {
    title: "Bring a Google Calendar token",
    body: "Generate an access token via the Google OAuth Playground and paste it into Settings to sync without an account.",
  },
  {
    title: "Run it however you like",
    body: "The project is open source and self-hostable. Clone it, add your env vars, and deploy wherever you run Next.js.",
  },
];

export default function InfoModal({
  onClose,
  onGetStarted,
}: {
  onClose: () => void;
  onGetStarted: () => void;
}) {
  const [tab, setTab] = useState<Tab>("product");
  const steps = tab === "product" ? PRODUCT_STEPS : FREE_STEPS;

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

  return (
    <div
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-modal-title"
        onClick={(event) => event.stopPropagation()}
        className="animate-scale-in max-h-[88vh] w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6 pb-4">
          <div className="space-y-1">
            <h2
              id="info-modal-title"
              className="font-display text-xl font-medium text-foreground"
            >
              How Loopin works
            </h2>
            <p className="text-sm text-tertiary">
              {tab === "product"
                ? "The fast, hands-off way — nothing to configure."
                : "Prefer no account? Bring your own keys."}
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

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div
            role="tablist"
            aria-label="How Loopin works sections"
            className="flex rounded-full bg-surface-muted p-1"
          >
            <button
              type="button"
              role="tab"
              id="tab-product"
              aria-selected={tab === "product"}
              aria-controls="panel-product"
              onClick={() => setTab("product")}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-full py-2 text-sm font-medium transition-colors cursor-pointer ${
                tab === "product"
                  ? "bg-surface text-foreground"
                  : "text-tertiary hover:text-foreground"
              }`}
            >
              Get started
            </button>
            <button
              type="button"
              role="tab"
              id="tab-free"
              aria-selected={tab === "free"}
              aria-controls="panel-free"
              onClick={() => setTab("free")}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-full py-2 text-sm font-medium transition-colors cursor-pointer ${
                tab === "free"
                  ? "bg-surface text-foreground"
                  : "text-tertiary hover:text-foreground"
              }`}
            >
              Free &amp; self-host
            </button>
          </div>
        </div>

        <div
          role="tabpanel"
          id={tab === "product" ? "panel-product" : "panel-free"}
          aria-labelledby={tab === "product" ? "tab-product" : "tab-free"}
          className="max-h-[52vh] overflow-y-auto px-6 py-5"
        >
          <ol key={tab} className="animate-fade-in space-y-5">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-tertiary">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/pricing"
            onClick={onClose}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            See pricing →
          </Link>
          {tab === "product" ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onGetStarted();
              }}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover cursor-pointer"
            >
              Create free account
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted cursor-pointer"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
