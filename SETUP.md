# Loopin v3 — Setup Guide

Everything you need to take Loopin v3 from clone to a working, sellable app.

> **Picking this repo up mid-setup?** Go straight to
> [Your manual checklist](#-your-manual-checklist-in-order) — it reflects the
> actual state of this machine. The [reference sections](#0-prerequisites)
> below document a full setup from scratch (for a fresh clone or new machine).

---

## ✅ Already done on this machine

Verified on 7 Oct 2026 — **don't redo any of this**:

| Done                                                                                                         | Evidence                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Supabase project **loopin** (`nqsubvlcndexrovexfzn`) with full schema, RLS policies, and performance indexes | tables exist; official advisors report no issues                         |
| `.env` filled in                                                                                             | Supabase keys, Google OAuth, Groq, OpenRouter, `CRON_SECRET` all present |
| Google sign-in works                                                                                         | your Google account exists in `auth.users`                               |
| Google Calendar connected                                                                                    | 1 row in `calendar_tokens`                                               |
| Extraction works locally                                                                                     | rows in `extractions`; app runs on `bun dev`                             |
| Vercel CLI signed in                                                                                         | `vercel whoami` → `tadstech`                                             |

**Still missing:** a production deploy, the production URL configuration, the
Bachs payment keys, and revoking one temporary token. That's the checklist
below. **~20 minutes total.**

---

## 📋 Your manual checklist (in order)

Work top to bottom. Each step says why, exactly what to do, and how to know
it worked.

### Step 1 — Revoke the temporary Supabase token · 1 min

During setup a temporary Personal Access Token was created so the assistant
could run SQL against your project. Revoke it — it's no longer needed.

1. Open <https://supabase.com/dashboard/account/tokens>.
2. Find the project token starting `sbp_fca34…` (created 7 Oct 2026).
3. **Delete** it.

✅ **Done when:** the token no longer appears in the list.

> Your production app never used this token — `.env` uses the project's own
> publishable/secret keys, so nothing breaks.

---

### Step 2 — `CRON_SECRET` · ✅ already done

A random `CRON_SECRET` is already in your `.env` (it protects
`/api/cron/reminders`). Nothing to do now — it rides along to Vercel in
Step 3. Regenerate any time by replacing the value (it must match on Vercel).

---

### Step 3 — Deploy to Vercel · ~10 min

The CLI is already signed in. Run everything from the repo root in
**PowerShell**:

```powershell
# 1. Link this folder to a Vercel project (interactive — accept the defaults
#    when prompted: scope = your account, project name = Loopin)
vercel link

# 2. Push every variable from .env to Vercel (production scope).
#    Skips SUPABASE_DB_PASS (local-only). Ignore "already exists" warnings
#    if you re-run it.
Get-Content .env | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
  $i = $_.IndexOf('=')
  $name = $_.Substring(0, $i)
  $value = $_.Substring($i + 1).Trim('"')
  if ($name -ne 'SUPABASE_DB_PASS') {
    Write-Host "-> $name"
    $value | vercel env add $name production
  }
}

# 3. First production deploy
vercel --prod
```

The last command prints your live URL (something like
`loopin-xxxx.vercel.app`). **Copy it.**

✅ **Done when:** `vercel env ls production` lists your variables, and the
printed URL loads the app.

---

### Step 4 — Production URLs (domain + Supabase auth) · 3 min

1. **Custom domain (optional but recommended):** Vercel dashboard → your
   project → **Settings → Domains** → add `loopin.tadstech.dev` (or whatever
   domain you want) and follow its DNS instructions. This repo's docs use
   `loopin.tadstech.dev` as the example host.
2. **Supabase:** Dashboard → your project → **Authentication → URL
   Configuration**:
   - **Site URL** → `https://loopin.tadstech.dev` (your production URL)
   - **Redirect URLs** → add `https://loopin.tadstech.dev/auth/callback`
     (keep the `http://localhost:3000/auth/callback` entry for local dev)
3. **Google Cloud:** nothing to change — the OAuth redirect URI points at
   Supabase (`https://nqsubvlcndexrovexfzn.supabase.co/auth/v1/callback`),
   which is domain-independent.

✅ **Done when:** Supabase shows your production URL as the Site URL.

---

### Step 5 — Production smoke test · 3 min

1. Open your production URL and **hard-refresh once**
   (`Ctrl+Shift+R`) — browsers may still hold the old cached page.
2. Sign in with Google → avatar appears in the header (no "Sign in" flash).
3. Drop a screenshot or paste a note → events extract (skeleton cards while
   it works).
4. Account menu → **Profile** → calendar shows **Connected**; **Settings**
   shows your keys saved.
5. Open `/pricing` → plans render.

Optional, when you want reminders to actually fire: point a every-minute cron
at your production URL:

```bash
curl https://loopin.tadstech.dev/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
```

✅ **Done when:** extraction works on the live URL.

---

### Step 6 — Payments, once the site is live (Bachs) · 20 min

Checkout runs through **[Bachs](https://bachs.io)**. Until `BACHS_API_KEY` is
set, the pricing button shows a "payments being finalised" notice — a valid
soft-launch state. Go through this ordered list **after** Steps 1–5:

1. Get a **sandbox** API key (`sk_sandbox_…`) from the Bachs Developer Portal
   → set `BACHS_API_KEY` on **Vercel** (and in local `.env` if you test
   checkout locally).
2. In the portal, create a webhook endpoint
   `https://loopin.tadstech.dev/api/webhooks/bachs` and subscribe to:
   `collection.succeeded`, `checkout.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`,
   `invoice.payment_failed`. Copy its signing secret →
   `BACHS_WEBHOOK_SECRET` on Vercel.
   - **Single slash only** — a `//` in the URL gets a 308 from Vercel and the
     delivery dies at the edge (nothing in `vercel logs`).
   - **Event source → Account events.** "Connected account events" makes
     auto-delivery route _nothing_ (`Delivery attempts: 0`) while manual
     Retry still works — a genuinely confusing failure mode.
   - The Vercel value must be **byte-identical** to the endpoint's signing
     secret — an empty/stale `BACHS_WEBHOOK_SECRET` = every delivery 401s.
3. **Sandbox E2E:** sign in → `/pricing` → Pro → pay with the Bachs test
   card. The **webhook** (not the redirect) must flip
   `public.subscriptions` to `plan='pro', status='active'` — check the row in
   Supabase and the server logs for `[bachs-webhook]` errors.
   If the row stays empty, read Bachs Delivery History + `vercel logs`:
   `Delivery attempts: 0` → event_source/event subscriptions; `401` → secret
   mismatch; `308` → URL; `200 {"received":true}` without a row → event type
   or missing metadata (see `[bachs-webhook] no entitlement` warn).
   **Trial path:** a **new account** (never subscribed) on a fresh browser
   sees "Start 7-day free trial"; checkout saves the card **without
   charging**; the webhook writes `plan='pro'` + `trial_end ≈ +7 days` and a
   `trial_devices` row (`status='active'`). After that both checks fail —
   same account → `already_subscribed`, any new account on the same browser
   → `device_used` (both surface as a normal "Upgrade" button; a direct
   trial request gets HTTP 403 `trial_ineligible` and the page falls back to
   regular checkout).
4. **Products: created in sandbox and wired.** `BACHS_PRODUCT_PRO_USD`,
   `BACHS_PRODUCT_PRO_NGN`, `BACHS_PRODUCT_TEAM_USD`,
   `BACHS_PRODUCT_TEAM_NGN` (monthly recurring) plus
   `BACHS_PRODUCT_PRO_USD_TRIAL` / `BACHS_PRODUCT_PRO_NGN_TRIAL` (same
   prices, `trial_period: 7 days`) — all six set on Vercel and locally.
   Raw pricing (no product) = one-time charge that **never expires**, so
   keep these set. Trial eligibility is enforced server-side in
   `/api/checkout`: never-subscribed account **and** unused device, and the
   trial product must exist (missing env → 503 `trial_not_configured`,
   never a silent charge).
5. **Going live** (~15 min, nothing crosses over — sandbox and production
   data are isolated; code is unchanged, the base URL follows the key
   prefix):
   1. Live mode → create `sk_live_…` → set `BACHS_API_KEY` on Vercel only.
      **Never use live keys locally.**
   2. Recreate the webhook endpoint (same URL, all seven events above,
      **Account events**) → new `whsec_…` → replace
      `BACHS_WEBHOOK_SECRET` on Vercel.
   3. Recreate all 6 products in live (4 recurring + 2 trial) → replace the
      six `BACHS_PRODUCT_*` values on Vercel.
   4. Redeploy → one small real payment → payload must show
      `"mode": "subscription"` and the row must flip to
      `plan='pro', status='active'`.

Full detail lives in `AGENTS.md`. Coverage for the webhook logic:
`tests/bachs.test.ts`.

---

### Optional — Supabase security toggle · 1 min

Dashboard → **Authentication → Settings** → enable
**Prevent use of leaked passwords** (HaveIBeenPwned check).

---

## Reference: full setup from scratch

The sections below describe a **fresh-machine** setup. On this machine you've
already passed most of them (see the ✅ table at the top).

### 0. Prerequisites

- **Bun** installed ([bun.sh](https://bun.sh))
- A **Supabase** account ([supabase.com](https://supabase.com))
- A **Google Cloud** project (for Google sign-in + Calendar)
- Optional: a **Groq** API key ([console.groq.com](https://console.groq.com)) for the shared/fallback AI key

---

### 1. Supabase project & keys

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
> while you migrate. **This machine already uses the new-format keys**
> (`sb_publishable_…` / `sb_secret_…`) stored under the legacy variable names
> — that works fine; renaming the variables is optional polish.

Also grab **Project URL** (`https://<ref>.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`.

---

### 2. Create the database schema

The schema creates `profiles`, `connected_calendars`, `calendar_tokens`
(secret tokens, service-role only), `subscriptions`, and `extractions`, all
with Row Level Security.

#### Option A — SQL Editor (easiest, ~20 seconds)

1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste and run [`supabase/schema.sql`](./supabase/schema.sql) — creates the core tables.
3. Paste and run [`supabase/migrations/20260702000000_platform.sql`](./supabase/migrations/20260702000000_platform.sql)
   — adds workspaces, public event pages, reminders, API keys, and webhooks.

Both files are idempotent (`create table if not exists` + `drop policy if exists`),
so re-running them is safe.

#### Option B — Supabase CLI

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

### 3. Google sign-in + Calendar (one-click setup)

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
> app (`https://www.googleapis.com/auth/calendar.events`, plus Supabase's
> default `email`/`profile`). Declare the same scopes on the Google Cloud
> OAuth consent screen → **Data access** page (see `verification.md`).

---

### 4. Environment variables

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

> `.env` is gitignored — secrets never leave this machine via git. Vercel gets
> its copy through the Step 3 command in the checklist.

---

### 5. Run it

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then
**Connect Google Calendar** on your profile page. Dropping a note or screenshot
should extract and sync.

---

### 6. Payments (optional, until you go live)

Checkout runs through **[Bachs](https://bachs.io)** — hosted checkout with USD
and NGN collection (cards, NGN bank transfer, mobile money elsewhere), a full
sandbox, and no Merchant-of-Record country restrictions.

> **Ordered, current-status instructions live in
> [checklist Step 6](#step-6--payments-once-the-site-is-live-bachs--20-min).**
> Summary below.

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
`customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, and
`invoice.payment_failed`. Deliveries are verified here against
`X-Bachs-Signature-V2` (HMAC-SHA256 of `{timestamp}.{raw body}`, 5-minute
replay window) using `BACHS_WEBHOOK_SECRET`. The `invoice.*` events carry
only a subscription id, so the handler fetches the subscription to recover
the metadata; `invoice.paid` concludes a trial (device → `ended`) and
re-grants, `invoice.payment_failed` only marks the device (access is kept
while payment recovery retries).

Sell through catalog products instead of raw pricing (required for
**recurring subscriptions**; raw pricing charges one-time). Sandbox ids are
already set; recreate the products in live when going live:

```env
BACHS_PRODUCT_PRO_USD=""   # prod_... id; recurring (billing_cycle: month)
BACHS_PRODUCT_PRO_NGN=""
BACHS_PRODUCT_TEAM_USD=""
BACHS_PRODUCT_TEAM_NGN=""
BACHS_PRODUCT_PRO_USD_TRIAL=""   # same price + trial_period: 7 days
BACHS_PRODUCT_PRO_NGN_TRIAL=""
```

Still building? The Developer Portal's **Local Testing** tab forwards live
webhook events to a port on your machine — no public URL or tunnel needed.
Going live is a key swap (`sk_live_`) plus the production base URL, which the
code selects automatically from the key prefix. See
[docs.bachs.io](https://docs.bachs.io).

---

### 6b. Platform features (teams, API, reminders, public pages)

These ship alongside the core extractor and use the second migration.

#### API & Webhooks

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

#### Smart Reminders

- Each extraction result has a **Remind me** action that schedules a reminder
  30 minutes before the event.
- Point a cron (every minute) at the processor:

  ```bash
  curl https://loopin.tadstech.dev/api/cron/reminders \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

  On Rumpty Cloud this maps to a managed scheduled job. Email/push delivery is
  pluggable in `app/api/cron/reminders/route.ts`.

#### Shared Calendars

- Create workspaces and invite teammates by email under
  **Profile → Shared calendars** (`/workspaces`). Row-level security restricts
  every membership query to the authenticated user.

#### Public Event Pages

- **Publish page** on any extracted event creates a shareable, indexable page at
  `/e/<slug>` with `Event` JSON-LD.

---

### 7. Plans & the free quota

- **Free** — **3 extractions per calendar month.** Enforced server-side in
  `app/actions.ts` by counting rows in `extractions` for the current month. No
  card required.
- **Pro** — unlimited extractions + hands-off sync. Set `subscriptions.plan`
  to `pro` (server-side, via your billing webhook when live).
- **Team** — same as Pro, multi-seat.

Quota resets on the **1st** of each month (UTC).

---

### 8. Deploy

> **The deploy flow is the checklist at the top of this file**
> (Steps 3–5: `vercel link` → env push → `vercel --prod` → domain + Supabase
> URLs → smoke test). Step 6 covers payments.

Summary: push to GitHub, import on Vercel (CLI already signed in as
`tadstech`), set the env vars from your local `.env`, add the production
domain to Supabase **Authentication → URL Configuration**, then run the
payments checklist.

---

## Troubleshooting

| Symptom                              | Fix                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| "Missing Groq API Key"               | Add `GROQ_API_KEY` or set a key on the **Settings** page (`/settings`)      |
| Google sign-in loops back signed-out | Redirect URL mismatch — verify `/auth/callback` is allow-listed in Supabase |
| Calendar sync stops after ~1 hour    | Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` so tokens can refresh       |
| Production shows old pages           | Hard-refresh once (`Ctrl+Shift+R`) — the service worker updates on reload   |
| `supabase db push` can't connect     | Use the Connection Pooler URL (DB host is IPv6-only on new projects)        |
| RLS blocks reads                     | Confirm you ran the full `supabase/schema.sql` including policies           |
