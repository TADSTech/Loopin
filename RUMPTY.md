# Rumpty Cloud Deployment Guide for Loopin

## Overview

This guide explains how to deploy the **Loopin** project to **Rumpty Cloud** for your hackathon. Rumpty Cloud is an Africa-based cloud platform (built in Lagos, Nigeria) offering free tier services including PostgreSQL databases, S3-compatible storage, Linux VMs, and one-click deployments.

## Prerequisites

- A **Rumpty Cloud account** (sign up at [rumptycloud.com](https://rumptycloud.com))
- The Loopin project code (this repository)
- Supabase project with schema already set up (refer to `SETUP.md`)
- Google OAuth credentials (Client ID/Secret)
- Bachs API keys for payments (sandbox key for hackathon)

## Step 1: Create Your Rumpty Cloud Project

1. Log in to [rumptycloud.com/console](https://rumptycloud.com/console)
2. Click **"Create New Project"** or **"Deployments"**
3. Choose **"Connect GitHub Repository"** and select this repo
4. Select **Next.js** as the framework
5. The platform will auto-detect:
   - Build command: `next build`
   - Start command: `next start`
   - Output directory: `.next`

## Step 2: Set Up PostgreSQL Database

1. In the Rumpty Cloud console, go to **"Managed Databases"**
2. Click **"Create PostgreSQL Database"**
3. Choose the **Playground** (free tier) plan
4. Note the connection string - you'll need this for environment variables
5. The database hostname will look like: `db.<project>.rumptycloud.ng`

## Step 3: Configure Environment Variables

In the Rumpty Cloud dashboard, go to **Project Settings → Environment Variables** and add:

```env
# Supabase (required - use your existing Supabase project)
NEXT_PUBLIC_SUPABASE_URL="https://<your-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

# Google OAuth (for sign-in + Calendar integration)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Managed AI (Groq or OpenRouter)
GROQ_API_KEY="your-groq-key"  # optional - opens free models fallback
OPENROUTER_API_KEY="your-openrouter-key"  # optional

# Cron job secret (protects /api/cron/reminders)
CRON_SECRET="random-string-at-least-32-chars"

# Bachs Payments (sandbox for hackathon)
BACHS_API_KEY="sk_sandbox_..."  # from Bachs Developer Portal
BACHS_WEBHOOK_SECRET="whsec_..."  # from Bachs webhook endpoint

# Bachs Product IDs (required for pricing page)
BACHS_PRODUCT_PRO_USD="prod_..."      # recurring monthly
BACHS_PRODUCT_PRO_NGN="prod_..."
BACHS_PRODUCT_TEAM_USD="prod_..."
BACHS_PRODUCT_TEAM_NGN="prod_..."
BACHS_PRODUCT_PRO_USD_TRIAL="prod_..._TRIAL"  # 7-day trial
BACHS_PRODUCT_PRO_NGN_TRIAL="prod_..._TRIAL"

# Rumpty Cloud specific
RUMPTY_DB_URL="postgresql://postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

**Important notes:**
- `SUPABASE_SECRET_KEY` is server-only - never expose in client code
- Bachs keys are required for the pricing page to work properly
- The `CRON_SECRET` must match what you use in `app/api/cron/reminders/route.ts`
- Google Client ID/Secret must match your Supabase OAuth configuration

## Step 4: Database Migration

Rumpty Cloud uses managed PostgreSQL, so you have two options:

### Option A: Use Supabase Schema (recommended - keeps existing setup)
1. Get your Rumpty Cloud PostgreSQL connection string
2. Run migrations using Supabase CLI or SQL Editor:
   ```bash
   # Using Supabase CLI (if linked)
   bunx supabase db push
   
   # Or using connection string directly
   bunx supabase db push --db-url "postgresql://postgres.<ref>:<password>@..."
   ```
3. Alternatively, run the SQL files from `supabase/` directory against your Rumpty Cloud DB

### Option B: Use Rumpty Cloud's Built-in SQL Editor
1. Go to **"SQL Editor"** in the Rumpty Cloud console
2. Paste and run `supabase/schema.sql`
3. Run `supabase/migrations/20260702000000_platform.sql`

## Step 5: Set Up Supabase Auth URLs

1. In Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to your Rumpty Cloud app URL (e.g., `https://loopin.rumptycloud.ng`)
3. Add **Redirect URLs**: `https://loopin.rumptycloud.ng/auth/callback`
4. Keep `http://localhost:3000/auth/callback` for local dev

## Step 6: Deploy

1. Rumpty Cloud will automatically start building on Git push
2. Monitor the deployment logs in the console
3. Once deployed, you'll get a URL like: `https://loopin-<hash>.rumptycloud.ng`

## Step 7: Custom Domain (Optional)

1. In Rumpty Cloud dashboard → **Settings → Domains**
2. Add your domain (e.g., `loopin.tadstech.dev`)
3. Follow DNS instructions to point to Rumpty Cloud nameservers

## Step 8: Test the Deployment

1. Open your Rumpty Cloud app URL
2. Sign in with Google → should work if Supabase auth is configured
3. Connect Google Calendar → should auto-refresh tokens
4. Drop a note/screenshot → extraction should work
5. Go to `/pricing` → should show plans (may show "payments finalising" notice until Bachs is fully configured)

## Troubleshooting on Rumpty Cloud

| Issue | Fix |
|-------|-----|
| "Application Error" on deployment | Check build logs - usually missing env vars or build command mismatch |
| Google sign-in loops | Verify Redirect URLs in Supabase match your Rumpty Cloud URL |
| Calendar sync stops | Add GOOGLE_CLIENT_ID/SECRET so tokens can refresh |
| Production shows old pages | Hard-refresh (`Ctrl+Shift+R`) - Rumpty Cloud updates on reload |
| Database connection fails | Verify `SUPABASE_SECRET_KEY` and `NEXT_PUBLIC_SUPABASE_URL` are correct |
| Bachs payment button shows notice | Set all 6 BACHS_PRODUCT_* env vars + Bachs webhook |

## Project Requirements & RAM Recommendations

### What Loopin Needs to Run

**Loopin** is a Next.js 16 app with these resource requirements:

| Component | Resource Usage | Notes |
|-----------|---------------|-------|
| **Next.js server** | ~50-100MB RAM | Server Components + API routes |
| **Supabase client** | ~20-30MB RAM | Database connections |
| **Google Calendar API** | ~10-15MB RAM | OAuth flow, token refresh |
| **Bachs checkout** | ~10-20MB RAM | Only on pricing page visits |
| **Extraction AI (Groq/OpenRouter)** | ~30-50MB RAM | Per-request, not constant |
| **Total baseline** | **~100-200MB RAM** | Idle state with signed-in user |

### Recommended RAM on Rumpty Cloud

**For hackathon sprint:** **1GB RAM (minimum), 2GB RAM (recommended)**

**Rationale:**
- The free tier on Rumpty Cloud typically starts at 1GB RAM for VM instances
- Loopin's baseline is ~100-200MB, but you need headroom for:
  - Concurrent users
  - AI extraction requests (Groq calls use burst memory)
  - Database connection pooling
  - Supabase realtime subscriptions
  - Google OAuth token refresh operations
- **1GB** is sufficient for a single-user hackathon demo
- **2GB** provides comfortable margin and allows for additional features (workspaces, team mode)
- Rumpty Cloud's pricing scales: you can start free and upgrade as needed

### If Using Managed Database (PostgreSQL)
- **Memory impact**: Minimal - managed DB handles its own memory
- **Connection pool**: Set `max_connections` to 20-30 for Next.js API routes
- **Recommendation**: The free PostgreSQL playground handles up to 5 concurrent connections comfortably

### If Using Rumpty Cloud VM
- **Free tier**: Typically 1GB RAM, 1 vCPU
- **Paid tier**: 2GB-8GB RAM options available
- **Start with**: 1GB, upgrade to 2GB if you need more concurrent users or want to run additional services (like Redis for caching)

## Hackathon-Specific Tips

1. **Use sandbox Bachs keys** - never use live keys during hackathon
2. **Free tier is generous** - 5 full-stack apps means you can test multiple variants
3. **Pay in naira or dollars** - choose whichever is more convenient for you
4. **Eco-friendly bonus** - Rumpty Cloud runs on ~90% solar power from Lagos
5. **Local testing** - use `bun dev` locally, then push to Rumpty Cloud for production

## Commands to Know

```bash
# Local development
bun install
bun dev

# Build for production
bun run build

# Test cron endpoint (needs CRON_SECRET)
curl https://your-app.rumptycloud.ng/api/cron/reminders -H "Authorization: Bearer $CRON_SECRET"
```

## Need Help?

- **Rumpty Cloud support**: Use the in-app chat or email support@rumptycloud.ng
- **Loopin-specific issues**: Check `SETUP.md` or `AGENTS.md` in this repo
- **Bachs payments**: Refer to `lib/bachs.ts` and `lib/payments.ts`

---

*Last updated: October 2026 - for hackathon deployment*