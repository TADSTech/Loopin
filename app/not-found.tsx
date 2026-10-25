import type { Metadata } from "next";
import Link from "next/link";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for doesn't exist or has moved.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-4 sm:px-6 md:max-w-4xl">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2 py-3 -my-3">
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/"
            className="flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
          >
            Try Loopin free
          </Link>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <p className="font-display text-6xl font-bold tracking-tight text-primary sm:text-7xl">
            404
          </p>
          <h1 className="mt-4 font-display text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            This page went off-calendar
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-tertiary">
            The page you were looking for does not exist or may have moved.
            Head back home to turn screenshots and notes into synced calendar
            events.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              Back to home
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              See pricing
            </Link>
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-2 py-5 text-sm text-tertiary sm:flex-row">
          <span>© 2026 loopin</span>
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center transition-colors hover:text-foreground md:min-h-0 md:min-w-0"
          >
            Support
          </a>
        </footer>
      </div>
    </main>
  );
}
