# loopin

**loopin** is a modern, high-performance web application built with Next.js 16 and React 19 designed to instantly extract structured calendar events from raw text notes or flyer screenshots using multimodal AI (Groq API) and sync them directly to Google Calendar.

---

## Key Features

- **Multimodal AI Event Extraction**: Drop image files (up to 3 event flyers, schedules, invite screenshots, or messaging threads) or paste raw, messy notes to extract structured events.
- **Google Calendar Synchronization**: Synchronizes parsed events directly into Google Calendar via native REST API calls.
- **Accounts & One-Click Google Setup**: Email/password and Google sign-in via Supabase. Connecting Google Calendar is a single click — OAuth tokens are stored server-side and refreshed automatically.
- **Lead-Gen Gate**: Extraction results are teased behind a sign-up prompt, capturing leads before revealing or syncing them.
- **Platform surface**: developer API with signed webhooks, scheduled reminders, shared workspaces, and publishable public event pages.
- **Minimal, System-Themed UI**: A calm, high-contrast Google-style interface that follows the user's light/dark system preference.
- **Absolute Responsive Layout**: Leverages CSS container queries and dynamic viewport height (`100dvh`) to prevent vertical layout shifts or horizontal overflows on mobile screens.
- **Production-Grade QA Pipeline**: Strict code format checks, linter validations, git pre-commit hooks, and unit tests.

---

## Technology Stack

- **Core Framework**: Next.js 16.2.10 (with Server Actions)
- **UI & View Engine**: React 19.2.4
- **Aesthetic Styling**: Tailwind CSS v4.3.2 (with custom theme variables)
- **Input Validation**: Zod v4.4.3
- **AI Integration**: OpenAI SDK v6.47.0 (configured with Groq endpoints)
- **Auth & Database**: Supabase (Postgres + Auth, `@supabase/ssr`)
- **Tooling**: Bun (runtime and test-runner), Prettier, ESLint, Husky

---

## Project Structure

```text
├── .agents/                    # Ralph's Method specs, plans, and tracking registries
├── .husky/                     # Git pre-commit hook files
├── app/                        # Next.js App Router codebase
│   ├── actions.ts              # Core actions: auth-aware ingest, quota, sync, account summary
│   ├── platform-actions.ts     # API keys, webhooks, workspaces, event pages, reminders
│   ├── api/checkout/           # Auth-gated checkout endpoint (hosted payment links)
│   ├── api/v1/extract/         # Public extraction API (Bearer key auth)
│   ├── api/cron/reminders/     # Scheduled reminder processor (maps to cloud cron)
│   ├── auth/callback/          # OAuth/PKCE callback — persists Google Calendar tokens
│   ├── about/                  # Indexable features + FAQ page (FAQ schema)
│   ├── components/             # Auth modal, tabbed info modal, structured data
│   ├── developers/             # API keys & webhooks console
│   ├── e/[slug]/               # Public event pages (Event JSON-LD)
│   ├── globals.css             # Tailwind v4 tokens (light + dark) and base styles
│   ├── layout.tsx              # Root SEO metadata, skip link, JSON-LD, Roboto
│   ├── manifest.ts             # PWA manifest
│   ├── opengraph-image.tsx     # Generated social share image
│   ├── page.tsx                # Dashboard: gate-but-preview, publish/remind actions
│   ├── pricing/page.tsx        # Pricing page with USD/NGN toggle
│   ├── profile/page.tsx        # Signed-in profile: plan, usage, calendar, advanced settings
│   ├── robots.ts / sitemap.ts  # Crawl rules and XML sitemap
│   └── workspaces/             # Shared calendars console
├── lib/                        # Shared utility layers
│   ├── api-keys.ts             # API key generation, hashing, constant-time compare
│   ├── event-intake.ts         # AI prompt engine + provider chain + Calendar sync
│   ├── event-types.ts          # Zod schemas and shared interface types
│   ├── google-calendar.ts      # Server-side Google token resolution and refresh
│   ├── payments.ts             # Plan metadata, currency formatting, checkout links
│   ├── quota.ts                # Free monthly extraction limit
│   ├── site.ts                 # Canonical URL, metadata, support email
│   ├── webhooks.ts             # Signed webhook delivery
│   └── supabase/               # Browser, server, admin clients and session proxy helper
├── supabase/
│   ├── schema.sql              # Tables + RLS (paste into the SQL editor)
│   └── migrations/             # CLI-applicable migrations
├── proxy.ts                    # Next.js 16 proxy (refreshes the Supabase session)
├── SETUP.md                    # Step-by-step setup guide
├── tests/                      # Core test suites (run via Bun Test)
│   ├── event-intake.test.ts    # Date normalizer and string manipulation unit tests
│   └── event-schema.test.ts    # Zod payload parser schema validation unit tests
└── package.json                # Project dependencies, devTools, and script triggers
```

---

## Getting Started

> **New here?** Follow the step-by-step [SETUP.md](./SETUP.md) to wire up Supabase,
> Google sign-in + Calendar, and payments.

### Prerequisites

- **Bun Runtime**: Make sure you have [Bun](https://bun.sh) installed.
- **Supabase Project**: Create one at [supabase.com](https://supabase.com), run `supabase/schema.sql` in the SQL editor, and enable the Google provider (with the Calendar scope) under Authentication → Providers.
- **Groq API Key** (optional): Get a key from the [Groq Console](https://console.groq.com). Users can also supply their own key in Settings.
- **Rumpty Cloud** (optional): For fastest hackathon deployment, you can use [Rumpty Cloud](https://rumptycloud.com) which provides managed PostgreSQL, one-click deployment, and a free tier of 5 full-stack apps. All environment variables documented below can be adapted from Rumpty Cloud's dashboard.

> **Note for self-hosters**: You can use any infrastructure you prefer (Vercel, Netlify, traditional VPS, etc.). All environment variables documented below can be migrated from Rumpty Cloud's settings if you start there.

### Installation

Clone this repository and install package dependencies:

```bash
bun install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Supabase — Project Settings → API Keys
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""   # sb_publishable_…
SUPABASE_SECRET_KEY=""                     # sb_secret_… (server-only)

# Google OAuth (for automatic token refresh; same creds as Supabase's Google provider)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Managed AI: Groq cheap Llama first, then OpenRouter's free router
GROQ_API_KEY=""
OPENROUTER_API_KEY=""

# Protects GET /api/cron/reminders
CRON_SECRET=""
```

### Running Locally

Start the local development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Verification & Commands

### Code Quality

Run Prettier check and ESLint:

```bash
# Check formatting
bun run format:check

# Format files
bun run format

# Run linter
bun run lint
```

### Running Tests

Run the test suite powered by Bun's native test-runner:

```bash
bun run test
```

### Building for Production

Compile Next.js production builds:

```bash
bun run build
```
