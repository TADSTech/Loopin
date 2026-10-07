import type { Metadata } from "next";
import Link from "next/link";

import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Loopin collects, uses, and protects your information — including exactly how Google account and Google Calendar data is accessed, stored, and shared.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: `${SITE.url}/privacy`,
    siteName: SITE.name,
    title: `Privacy Policy | ${SITE.name}`,
    description:
      "How Loopin collects, uses, and protects your information — including Google user data.",
  },
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "Overview",
    body: [
      `Loopin ("Loopin", "we", "us") is an AI calendar extraction service available at ${SITE.url}. This policy explains what information we collect, how we use it, and the choices you have. It also describes specifically how we access, use, store, and share Google user data, as required by Google's API Services User Data Policy.`,
      "By using Loopin you agree to the collection and use of information as described here. If you do not agree, please do not use the service.",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Account information. When you sign in with Google we receive your name, email address, and profile picture from Google. If you create an account with email and password, we store your email address. Account data is held by Supabase Auth.",
      "Content you submit. You may submit text and up to three images per extraction run. Images are processed by our AI provider to produce event results and are not stored by Loopin. For signed-in users we keep a short usage record: a preview of the first 140 characters of your text (or an image count), the number of events found, and how many synced. This powers your monthly free-tier quota.",
      "Calendar connection. When you connect Google Calendar we store an OAuth access token, a refresh token, and your calendar ID so that Loopin can create the events you extract in your calendar.",
      "Profile and preferences. Your chosen avatar emoji and colour, your timezone, and your subscription plan are stored with your account.",
      "Bring-your-own settings. Any Groq API key, calendar ID, or access token you enter on the Settings page is stored only in your browser's local storage on your own device.",
      "Payment information. Paid plans are handled by our payment provider Bachs. We do not see or store your full card or bank details; we receive confirmation of your plan status.",
    ],
  },
  {
    heading: "How we use information",
    body: [
      "We use information to operate the service: extracting events from your input, syncing them to Google Calendar, enforcing the free-plan quota, showing your history, sending service-related notices, and processing subscriptions when you pay for a plan.",
      "We do not use your information for advertising, and we do not sell or rent personal data to anyone.",
    ],
  },
  {
    heading: "How we access, use, store, and share Google user data",
    body: [
      "Categories of Google user data we access: your Google account basic profile (name, email, profile picture) when you use Sign in with Google, and the Google OAuth credentials needed to connect Google Calendar.",
      "What we do with it: the profile identifies your account. The calendar credentials let Loopin create events you have extracted in your Google Calendar. Loopin does not read, copy, store, or analyse the existing entries in your calendar — the connection is used only to add new events that you have reviewed.",
      "Purposes: authentication, one-click calendar setup, and syncing extracted events, and nothing else.",
      "Storage: Google user data is stored in our Supabase database, protected by row-level security, and transmitted over HTTPS.",
      "Sharing: Google user data is shared only with our processors that help us run Loopin — Supabase (hosting, authentication, database) and, for sync, Google itself. Your Google credentials are never sent to our AI providers; they receive only the images or text you submit for extraction.",
      "We do not sell Google user data, do not share it for advertising, and do not use it to train AI models.",
      "Retention and revocation: we keep Google user data while your account exists or until you revoke access. You can revoke Loopin's access at any time at https://myaccount.google.com/permissions (Google Account → Security → Third-party access), or by contacting us to delete your account.",
    ],
  },
  {
    heading: "AI processing",
    body: [
      "Extraction requests are sent to Groq (our default provider) or OpenRouter (fallback or your own configured key) to turn your images and text into structured calendar events. These providers process your submitted content to return results; their handling of data is governed by their own privacy policies.",
      "Only the content you submit for an extraction is sent — never your Google tokens or account credentials. If you bring your own API key, your key is used for your requests and stays in your browser.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "Loopin uses only an essential session cookie (Supabase authentication) to keep you signed in, plus browser local storage for your preferences and bring-your-own settings. We run no analytics, advertising, or tracking cookies.",
    ],
  },
  {
    heading: "Third-party services",
    body: [
      "Loopin relies on these processors: Supabase (authentication and database), Vercel (hosting), Groq and OpenRouter (AI inference), Google (Sign in with Google and the Google Calendar API), and Bachs (payment processing for paid plans). Each processes data under its own terms and privacy policy.",
    ],
  },
  {
    heading: "Data retention and deletion",
    body: [
      "We keep your information for as long as your account exists. To delete your account and its associated data — including extraction history and stored calendar tokens — email us at the address below. Revoking access at Google stops any further calendar sync immediately.",
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      "Loopin is not directed at children under 13, and we do not knowingly collect personal information from them. If you believe a child has provided us with information, contact us and we will delete it.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this policy from time to time. The revised version will be posted on this page with an updated date at the top. Continued use of Loopin after changes means you accept the revised policy.",
    ],
  },
  {
    heading: "Contact",
    body: [`Questions about this privacy policy? Email ${SITE.supportEmail}.`],
  },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
              href="/terms"
              className="inline-flex min-h-11 min-w-11 md:min-h-0 md:min-w-0 items-center justify-center transition-colors hover:text-foreground"
            >
              Terms
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
