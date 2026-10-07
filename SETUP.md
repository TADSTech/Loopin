# Loopin v3 — Setup Guide

Everything you need to take Loopin v3 from clone to a working, sellable app.
Follow the steps in order. Total time: ~15 minutes.

---

## 0. Prerequisites

- **Bun** installed ([bun.sh](https://bun.sh))
- A **Supabase** account ([supabase.com](https://supabase.com))
- A **Google Cloud** project (for Google sign-in + Calendar)
- Optional: a **Groq** API key ([console.groq.com](https://console.groq.com)) for the shared/fallback AI key

---

## 1. Supabase project & keys

1. Create a new project at [database.new](https://database.new).
2. Open **Project Settings → API Keys**.
3. You need **two** keys:

| Key                                      | Used by                           | Where                                  |
| ---------------------------------------- | --------------------------------- | -------------------------------------- |
| **Publishable key** (`sb_publishable_…`) | Browser + server clients          | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| **Secret key** (`sb_secret_…`)           | Server-only admin (token storage) | `SUPABASE_SECRET_KEY`                  |

> **Note on legacy keys.** Supabase is deprecating the old JWT-based
> `anon` and `service_role` keys (removed end of 2026). If your project still
> only shows those, click **Create new API keys** in the API Keys tab — the new
> keys are created _alongside_ the legacy ones, so nothing breaks.
>
> This codebase reads the **new names first** and falls back to the legacy
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, so both work
> while you migrate.

Also grab **Project URL** (`https://<ref>.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`.

---

## 2. Create the database schema

The schema creates `profiles`, `connected_calendars`, `calendar_tokens`
(secret tokens, service-role only), `subscriptions`, and `extractions`, all
with Row Level Security.

### Option A — SQL Editor (easiest, ~20 seconds)

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste and run [`supabase/schema.sql`](./supabase/schema.sql) — creates the core tables.
3. Paste and run [`supabase/migrations/20260702000000_platform.sql`](./supabase/migrations/20260702000000_platform.sql)
   — adds workspaces, public event pages, reminders, API keys, and webhooks.

Both files are idempotent (`create table if not exists` + `drop policy if exists`),
so re-running them is safe.

### Option B — Supabase CLI

```bash
# Link once
bunx supabase link --project-ref <your-project-ref>

# Apply the migration
bunx supabase db push
```

If you can't reach the direct DB host (it's IPv6-only on newer projects), use
the **Connection Pooler** string from **Project Settings → Database → Connection
string** instead:

```bash
bunx supabase db push --db-url "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

> Passing the raw DB password as a URL is fine locally, but prefer `supabase link`
> so the CLI stores it for you.

---

## 3. Google sign-in + Calendar (one-click setup)

Loopin signs users in with Google **and** requests Calendar access in the same
flow, so syncing needs no manual tokens.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. **Create Credentials → OAuth client ID → Web application**.
3. Add an **Authorized redirect URI** (exactly):

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

4. Copy the **Client ID** and **Client Secret**.
5. In Supabase: **Authentication → Providers → Google** → enable it and paste the
   Client ID & Secret. Save.
6. In Google Cloud, open **APIs & Services → Library**, enable the
   **Google Calendar API**.
7. Add the same Client ID/Secret to your env as `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET`. These are only used server-side to **auto-refresh**
   Calendar tokens after ~1 hour (Google tokens are short-lived).
8. In Supabase **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` (dev) and your production URL
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
     `https://your-domain.com/auth/callback`

> The scopes we request at sign-in aren't configured here — they're sent by the
> app (`https://www.googleapis.com/auth/calendar`).

---

## 4. Environment variables

Copy `.env.example` → `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."   # new key (preferred)
SUPABASE_SECRET_KEY="sb_secret_..."                         # new key (server-only)

# Legacy fallbacks (only if you haven't created the new keys yet)
# NEXT_PUBLIC_SUPABASE_ANON_KEY=""
# SUPABASE_SERVICE_ROLE_KEY=""

# Google (for automatic Calendar token refresh)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Managed AI for signed-in users — tried in order:
# 1) Groq cheap Llama (llama-3.1-8b-instant), 2) OpenRouter free router
GROQ_API_KEY=""
OPENROUTER_API_KEY=""

# Protects the scheduled reminder processor
CRON_SECRET=""
```

The managed provider chain is intentional: extraction first tries **Groq** with
`llama-3.1-8b-instant` (the cheapest callable Llama — about $0.05 / 1M input
tokens), and on any failure falls back to **OpenRouter's free-models router**
(`openrouter/free`), which picks an available free model automatically. A user
who supplies their own Groq key uses only their key.

> Your repo currently ships a `.env` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
> `SUPABASE_SERVICE_ROLE_KEY`. Those keep working via the fallback, but migrate
> to the publishable/secret keys above when you can.

---

## 5. Run it

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then
**Connect Google Calendar** on your profile page. Dropping a note or screenshot
should extract and sync.

---

## 6. Payments (optional, until you go live)

Checkout runs through **[Bachs](https://bachs.io)** — hosted checkout with USD
and NGN collection (cards, NGN bank transfer, mobile money elsewhere), a full
sandbox, and no Merchant-of-Record country restrictions.

```env
BACHS_API_KEY=""          # sk_sandbox_... (sandbox) or sk_live_... (production)
BACHS_WEBHOOK_SECRET=""   # signing secret from the Developer Portal endpoint
```

The pricing page calls `POST /api/checkout` (requires a signed-in user), which
creates a Bachs checkout session and redirects to the hosted page. Prices come
from the plan catalog in `lib/payments.ts` as raw pricing — no dashboard setup
needed to test. Until `BACHS_API_KEY` is set, the button shows a "payments
being finalised" notice — a valid soft-launch state that still captures the
account.

**Webhooks are the source of truth** for upgrades (never the redirect). In the
Bachs Developer Portal add a webhook destination pointing at:

```
https://<your-domain>/api/webhooks/bachs
```

Subscribe to `collection.succeeded`, `checkout.completed`,
`customer.subscription.created`, `customer.subscription.updated`, and
`customer.subscription.deleted`. Deliveries are verified here against
`X-Bachs-Signature-V2` (HMAC-SHA256 of `{timestamp}.{raw body}`, 5-minute
replay window) using `BACHS_WEBHOOK_SECRET`.

Optional — sell through catalog products instead of raw pricing (needed for
**recurring subscriptions**; raw pricing charges one-time). Create the products
in the Bachs dashboard or API, then:

```env
BACHS_PRODUCT_PRO_USD=""   # prod_... id; recurring (billing_cycle: month)
BACHS_PRODUCT_PRO_NGN=""
BACHS_PRODUCT_TEAM_USD=""
BACHS_PRODUCT_TEAM_NGN=""
```

Still building? The Developer Portal's **Local Testing** tab forwards live
webhook events to a port on your machine — no public URL or tunnel needed.
Going live is a key swap (`sk_live_`) plus the production base URL, which the
code selects automatically from the key prefix. See
[docs.bachs.io](https://docs.bachs.io).

---

## 6b. Platform features (teams, API, reminders, public pages)

These ship alongside the core extractor and use the second migration.

### API & Webhooks

- Create keys under **Profile → API & webhooks** (`/developers`). Only a hash is
  stored; the plaintext key is shown once.
- Call the extraction API:

  ```bash
  curl -X POST https://loopin.tadstech.dev/api/v1/extract \
    -H "Authorization: Bearer loop_..." \
    -H "Content-Type: application/json" \
    -d '{"text":"Team standup Friday 9am at the office","timezone":"Africa/Lagos"}'
  ```

- Register webhooks for `extraction.completed`. Deliveries are signed
  HMAC-SHA256 in the `X-Loopin-Signature` header (`sha256=<hex>`).

### Smart Reminders

- Each extraction result has a **Remind me** action that schedules a reminder
  30 minutes before the event.
- Point a cron (every minute) at the processor:

  ```bash
  curl https://loopin.tadstech.dev/api/cron/reminders \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

  On Rumpty Cloud this maps to a managed scheduled job. Email/push delivery is
  pluggable in `app/api/cron/reminders/route.ts`.

### Shared Calendars

- Create workspaces and invite teammates by email under
  **Profile → Shared calendars** (`/workspaces`). Row-level security restricts
  every membership query to the authenticated user.

### Public Event Pages

- **Publish page** on any extracted event creates a shareable, indexable page at
  `/e/<slug>` with `Event` JSON-LD.

---

## 7. Plans & the free quota

- **Free** — **3 extractions per calendar month.** Enforced server-side in
  `app/actions.ts` by counting rows in `extractions` for the current month. No
  card required.
- **Pro** — unlimited extractions + hands-off sync. Set `subscriptions.plan`
  to `pro` (server-side, via your billing webhook when live).
- **Team** — same as Pro, multi-seat.

Quota resets on the **1st** of each month (UTC).

---

## 8. Deploy

1. Push to GitHub.
2. Import the repo on Vercel (or any Next.js host).
   - The `vercel` CLI is already signed in on this machine
     (`vercel whoami` → `tadstech`): `vercel` links a project,
     `vercel deploy` ships a preview, `vercel --prod` goes live.
     Vercel auto-detects Bun from `bun.lock`.
3. Set these env vars (values come from your local `.env`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GROQ_API_KEY`
   - `OPENROUTER_API_KEY`

   (`SUPABASE_DB_PASS` is local-only — no code reads it.)

4. Add your production domain to Supabase **Authentication → URL Configuration**
   and to the Google OAuth redirect URIs.
5. Set the production `Site URL`.
6. Payments: once the site is live, follow the checklist in `AGENTS.md`
   (`BACHS_API_KEY` → webhook endpoint + `BACHS_WEBHOOK_SECRET` → sandbox E2E).

---

## Troubleshooting

| Symptom                              | Fix                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| "Missing Groq API Key"               | Add `GROQ_API_KEY` or set a key in your profile's Advanced section          |
| Google sign-in loops back signed-out | Redirect URL mismatch — verify `/auth/callback` is allow-listed in Supabase |
| Calendar sync stops after ~1 hour    | Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` so tokens can refresh       |
| `supabase db push` can't connect     | Use the Connection Pooler URL (DB host is IPv6-only on new projects)        |
| RLS blocks reads                     | Confirm you ran the full `supabase/schema.sql` including policies           |
