import type { Metadata } from "next";
import Link from "next/link";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of Loopin — the service, accounts, acceptable use, AI output, subscriptions, and third-party services.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    url: `${SITE.url}/terms`,
    siteName: SITE.name,
    title: `Terms of Service | ${SITE.name}`,
    description:
      "The terms that govern your use of Loopin — the service, accounts, acceptable use, AI output, and subscriptions.",
  },
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "Agreement to terms",
    body: [
      `These Terms of Service ("Terms") govern your use of Loopin, available at ${SITE.url}. By accessing or using Loopin you agree to these Terms and to our Privacy Policy. If you do not agree, do not use the service.`,
    ],
  },
  {
    heading: "The service",
    body: [
      "Loopin uses AI to extract calendar events from images and text you provide, and can sync the resulting events to your Google Calendar. Features may change, be added, or be removed over time.",
    ],
  },
  {
    heading: "Accounts",
    body: [
      "You need an account to use calendar sync and paid plans. You agree to provide accurate information and to keep your sign-in credentials secure. You are responsible for activity that happens under your account.",
    ],
  },
  {
    heading: "Your content",
    body: [
      "You keep ownership of everything you submit — images, text, and the events they contain. You grant us a limited licence to host and process that content solely to provide the service to you (for example, sending an extraction to an AI provider and syncing results to your calendar).",
    ],
  },
  {
    heading: "AI-generated results",
    body: [
      "Extraction results are produced by AI models and may be inaccurate, incomplete, or mis-timed. Loopin does not guarantee the accuracy of any result. You are responsible for reviewing extracted events before relying on them or syncing them to your calendar.",
    ],
  },
  {
    heading: "Google account and Calendar access",
    body: [
      "Connecting Google Calendar grants Loopin permission to create events in your calendar under the Google OAuth scope you approve. How we access, use, store, and share Google user data is described in our Privacy Policy. You can revoke access at any time from your Google Account, which stops further sync immediately.",
    ],
  },
  {
    heading: "Your API keys and credentials",
    body: [
      "You may supply your own Groq API key, calendar ID, or access token. These stay in your browser and are used only for your requests. You are responsible for keeping them secret and for any usage incurred through keys you provide, subject to each provider's own terms.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "You agree not to: use Loopin for unlawful purposes or to submit unlawful content; interfere with or overload the service; attempt to circumvent usage limits or access other people's accounts; reverse-engineer the service except where law permits; resell access to Loopin; or breach the terms of the third-party services it connects to, including the Google APIs Terms of Service.",
    ],
  },
  {
    heading: "Subscriptions and billing",
    body: [
      "The free plan includes a limited number of AI extractions per month. Paid plans offer unlimited extractions at the prices shown on the pricing page, in USD or NGN. Payments are processed by our payment provider Bachs; by purchasing you also agree to their terms.",
      "Paid subscriptions renew automatically until you cancel. You can cancel anytime; your plan stays active until the end of the current billing period. Fees are non-refundable except where required by law.",
    ],
  },
  {
    heading: "Third-party services",
    body: [
      "Loopin depends on third parties — Google (sign-in and Calendar), Groq and OpenRouter (AI inference), Supabase (database and auth), Vercel (hosting), and Bachs (payments). These services operate under their own terms, and we are not responsible for their operation, changes, or downtime.",
    ],
  },
  {
    heading: "Our intellectual property",
    body: [
      "Loopin, including its name, design, and software, belongs to us and our licensors. If you send us feedback or suggestions, we may use them without obligation to you.",
    ],
  },
  {
    heading: "Termination",
    body: [
      "We may suspend or terminate accounts that breach these Terms, misuse the service, or create risk for others. You can stop using Loopin and ask us to delete your account at any time by emailing the address below. Provisions that by their nature should survive termination will survive.",
    ],
  },
  {
    heading: "Disclaimers",
    body: [
      `The service is provided "as is" and "as available". To the maximum extent permitted by law we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement, and we do not warrant that the service will be uninterrupted, secure, or error-free, or that extraction results will be accurate.`,
    ],
  },
  {
    heading: "Limitation of liability",
    body: [
      "To the maximum extent permitted by law, Loopin and its operators will not be liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, data, or goodwill. Our total liability for any claim arising out of the service is limited to the greater of the amounts you paid us in the twelve months before the claim, or USD 50.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these Terms from time to time. The revised version will be posted on this page with an updated date at the top. Using Loopin after changes are posted means you accept the revised Terms.",
    ],
  },
  {
    heading: "Contact",
    body: [`Questions about these terms? Email ${SITE.supportEmail}.`],
  },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-tertiary">
            Last updated October 7, 2026
          </p>

          {SECTIONS.map((section, index) => (
            <section
              key={section.heading}
              className={index === 0 ? "mt-8" : "mt-10"}
            >
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                {section.heading}
              </h2>
              {section.body.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-relaxed text-tertiary"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <footer className="flex flex-col items-start gap-1 py-4 text-sm text-tertiary sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-5">
          <span>© 2026 loopin</span>
          <div className="flex flex-wrap items-center gap-x-5">
            <Link
              href="/"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Support
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
