import type { Metadata } from "next";
import Link from "next/link";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About & FAQ",
  description:
    "What Loopin is, how AI calendar event extraction works, and answers to common questions about Google Calendar sync, pricing, and bringing your own AI keys.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: `${SITE.url}/about`,
    siteName: SITE.name,
    title: `About & FAQ | ${SITE.name}`,
    description:
      "How Loopin turns screenshots and notes into synced Google Calendar events — plus answers to common questions.",
  },
};

const FEATURES = [
  {
    title: "Drop anything",
    body: "Screenshots, event flyers, group-chat exports, or a wall of pasted text. Up to three images at once.",
  },
  {
    title: "AI does the reading",
    body: "Loopin pulls out the title, date, time, location, and notes for every event it finds, with a confidence score.",
  },
  {
    title: "Syncs to your calendar",
    body: "Connect Google Calendar once and every upcoming event lands in the right place automatically.",
  },
];

const FAQ = [
  {
    q: "How do I turn a screenshot into a calendar event?",
    a: "Drop the screenshot into Loopin. The AI reads the image, extracts the event details, and syncs them to Google Calendar. You can also paste raw text or notes instead of an image.",
  },
  {
    q: "Does Loopin sync with Google Calendar?",
    a: "Yes. Sign in with Google once and Loopin connects your calendar in a single click. Newly extracted events sync automatically, so there are no tokens to copy or paste.",
  },
  {
    q: "Is Loopin free?",
    a: "Yes. The free plan includes 3 AI extractions every month with no card required. Pro unlocks unlimited extractions and hands-off sync, billed in USD or NGN.",
  },
  {
    q: "Can I use my own AI keys?",
    a: "Yes. Bring your own Groq API key and Google Calendar token in your profile, or self-host Loopin and run it entirely on your own infrastructure.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function AboutPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="relative flex min-h-dvh flex-col bg-background text-foreground antialiased"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between py-4">
          <Link href="/" className="flex items-baseline gap-2 py-3 -my-3">
            <span className="font-display text-[22px] leading-none font-bold tracking-tight text-foreground">
              loopin
            </span>
            <span className="text-xs font-medium text-tertiary">v3.0</span>
          </Link>
          <Link
            href="/"
            className="flex h-11 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            Back to app
          </Link>
        </header>

        <div className="flex-1 py-8">
          <h1 className="font-display text-[32px] leading-[38px] font-bold tracking-tight text-foreground">
            AI calendar extraction that just works
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-tertiary">
            Loopin turns unstructured input into clean calendar events. Drop a
            conference flyer, a screenshot of a group chat, or a wall of text —
            the AI reads it, pulls out the title, date, time, and location, and
            syncs each event to your Google Calendar in seconds.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-border bg-surface p-5"
              >
                <h2 className="font-display text-base font-medium text-foreground">
                  {feature.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-tertiary">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-display text-2xl font-bold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <dl className="mt-4 space-y-3">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <dt className="text-sm font-medium text-foreground">
                  {item.q}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed text-tertiary">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover"
            >
              See pricing
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              Try Loopin free
            </Link>
          </div>
        </div>

        <footer className="flex flex-col items-start gap-1 py-4 text-sm text-tertiary sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-5">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-x-5">
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Support
            </a>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Home
            </Link>
          </div>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />
    </main>
  );
}
