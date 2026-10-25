# Rumpty Cloud Deployment Guide for Loopin

**v3.0** — Hackathon Deployment Checklist

*Loopin v3 — AI calendar event extraction & Google Calendar sync*

***

## 📋 Table of Contents

1. [Overview](#overview)
2. [Get Started](#get-started)
3. [Platform Configuration](#platform-configuration)
4. [Deployment](#deployment)
5. [Self-Hosting Note](#self-hosting-note)
6. [RAM Recommendations](#ram-recommendations)
7. [Hackathon Tips](#hackathon-specific-tips)
8. [Commands](#commands-to-know)
9. [Need Help?](#need-help)

---

## 1. Overview

This guide explains how to deploy the **Loopin** project to **Rumpty Cloud** for your hackathon.

**Rumpty Cloud** is a cloud platform built in Lagos, Nigeria offering:

- Free tier: 5 full-stack apps
- Eco-friendly infrastructure: ~90% solar-powered (Lagos-based)
- Managed hosting with predictable pricing
- One-click deployment from Git
- Pay in naira or dollars
- Designed for African developers and global builders alike

**Loopin** is a Next.js 16 app that:

- Extracts calendar events from images and text using AI
- Syncs events to Google Calendar in one click
- Enforces a free-tier quota of 3 extractions per month
- Processes payments through [Bachs.io](https://bachs.io)
- Supports Google Sign-in and Calendar OAuth

> **Rumpty Cloud** is the recommended platform for rapid deployment. You can self-host Loopin using any infrastructure (Vercel, Netlify, traditional VPS, etc.), but this guide focuses on getting you on Rumpty Cloud fastest.

---

## 2. Get Started

### 2.1 Create Your Rumpty Cloud Account

1. Visit [rumptycloud.com](https://rumptycloud.com) and sign up for an account
2. Verify your email and log in to the [Rumpty Cloud console](https://rumptycloud.com/console)
3. Note your dashboard URL — you'll use this to manage your app

### 2.2 Quick Prerequisites

| Item | Needed For |
|------|------------|
| **Rumpty Cloud account** | All deployment steps |
| **Loopin codebase** | This repository |
| **Google OAuth** | Client ID and Secret from Google Cloud Console |
| **Bachs payments** | Sandbox API key for hackathon (never use live keys locally) |

> **Already completed** (verified 7 Oct 2026):
> - ✅ Google sign-in works
> - ✅ Google Calendar connected
> - ✅ Extraction works locally (`bun dev`)
> - ✅ Vercel CLI signed in (`vercel whoami` → `tadstech`)

> **Still missing**: production deploy, production URL, Bachs payment keys.

> **~15 minutes** to complete remaining steps.

---

## 3. Platform Configuration

### 3.1 Connect Your Repository

1. In the Rumpty Cloud dashboard, click **"Create New Project"** or **"Deployments"**
2. Choose **"Connect GitHub Repository"** and select this repo
3. Select **Next.js** as the framework
4. The platform auto-detects:
   - Build command: `next build`
   - Start command: `next start`
   - Output directory: `.next`

### 3.2 Environment Variables

In the Rumpty Cloud dashboard → **Project Settings → Environment Variables**, add all required vars:

```env
# ===== SUPABASE (required) =====
NEXT_PUBLIC_SUPABASE_URL="https://<your-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."  # server-only — never expose in client code

# ===== GOOGLE OAUTH =====
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# ===== MANAGED AI =====
# Groq cheap Llama — ~$0.05 / 1M input tokens
# OpenRouter free-models router — falls back automatically
GROQ_API_KEY="your-groq-key"       # optional — use only if you supplied your own key
OPENROUTER_API_KEY="your-openrouter-key"  # optional — free models fallback

# ===== CRON SECRET =====
# Generate a random string >= 32 characters
CRON_SECRET="random-string-at-least-32-chars"

# ===== BACHS PAYMENTS (sandbox) =====
BACHS_API_KEY="sk_sandbox_..."
BACHS_WEBHOOK_SECRET="whsec_..."  # from Bachs webhook endpoint

# ===== BACHS PRODUCT IDs =====
BACHS_PRODUCT_PRO_USD="prod_..."          # recurring monthly, USD
BACHS_PRODUCT_PRO_NGN="prod_..."          # recurring monthly, NGN
BACHS_PRODUCT_TEAM_USD="prod_..."         # recurring monthly, USD (team)
BACHS_PRODUCT_TEAM_NGN="prod_..."         # recurring monthly, NGN (team)
BACHS_PRODUCT_PRO_USD_TRIAL="prod_..._TRIAL"  # 7-day trial, USD
BACHS_PRODUCT_PRO_NGN_TRIAL="prod_..._TRIAL"  # 7-day trial, NGN

# ===== RUMMPTY CLOUD =====
# The platform selects the base URL automatically from the key prefix.
# No additional config needed — code detects sandbox vs live mode.
```

> **Critical notes:**
> - `SUPABASE_SECRET_KEY` is **server-only** — never expose in client code or commit to git
> - Bachs keys are **required** for the pricing page to function
> - The `CRON_SECRET` **must match** what you use in `app/api/cron/reminders/route.ts`
> - Google Client ID/Secret **must match** your Supabase OAuth configuration
> - **Single slash only** in webhook URL — a `//` gets a 308 from Vercel and delivery dies at the edge
> - **Event source → Account events** — "Connected account events" makes auto-delivery route nothing; manual Retry still works
> - The Vercel secret must be **byte-identical** to the endpoint's signing secret

> **Platform note**: Rumpty Cloud automatically selects the correct base URL (sandbox vs production) from your Bachs key prefix. No manual URL configuration needed.

---

## 4. Deployment

### 4.1 Automatic Build & Deploy

1. Rumpty Cloud starts building automatically on Git push
2. Monitor deployment logs in the console
3. Once deployed, you'll get a URL like: `https://loopin-<hash>.rumptycloud.ng`

### 4.2 Configure Supabase Auth

1. In Supabase Dashboard → **Authentication → URL Configuration**
2. Set **Site URL** to your Rumpty Cloud app URL (e.g., `https://loopin.rumptycloud.ng`)
3. Add **Redirect URLs**: `https://loopin.rumptycloud.ng/auth/callback`
4. Keep `http://localhost:3000/auth/callback` for local dev

### 4.3 Test the Deployment

1. Open your Rumpty Cloud app URL
2. Sign in with Google → avatar appears in header (no "Sign in" flash)
3. Drop a note or screenshot → events extract (skeleton cards while it works)
4. Account menu → **Profile** → calendar shows **Connected**
5. Open `/pricing` → plans render (may show "payments being finalised" notice until Bachs is fully configured)

> **Done when**: Extraction works on the live URL, Google sign-in flows work, and the pricing page loads.

---

## 5. Self-Hosting Note

> **Note for self-hosters**: Loopin is fully self-hostable. You can deploy to any platform that supports Next.js (Vercel, Netlify, traditional VPS, Cloudflare Pages, etc.). All environment variables documented in this guide can be adapted to your chosen platform.

> The app uses:
> - **Supabase** for database, auth, and RLS (you'll need your own Supabase project)
> - **Bachs** for payments (create a free account at bachs.io)
> - **Groq** or **OpenRouter** for AI extraction (API keys required)
> - **Google Cloud** for OAuth (API keys required)

> **Rumpty Cloud** is recommended for this hackathon because it provides:
> - Free PostgreSQL database (no separate Supabase account needed for basic use)
> - One-click deployment from Git
> - Predictable free tier (5 full-stack apps)
> - Eco-friendly infrastructure (~90% solar, Lagos-based)
> - Pay-in-naira option
> - Built-in deployment pipeline

> If you choose a different platform, you'll need to:
> 1. Set up your own Supabase project (free tier available at supabase.com)
> 2. Configure Bachs payments with your own webhook endpoint
> 3. Set up Google OAuth credentials
> 4. Deploy your Next.js app to your chosen platform

---

## 6. RAM Recommendations

### What Loopin Needs to Run

| Component | Resource Usage | Notes |
|-----------|---------------|-------|
| **Next.js server** | ~50-100 MB RAM | Server Components + API routes |
| **Supabase client** | ~20-30 MB RAM | Database connections |
| **Google Calendar API** | ~10-15 MB RAM | OAuth flow, token refresh (hourly) |
| **Bacs checkout** | ~10-20 MB RAM | Only loaded on `/pricing` page visits |
| **Extraction AI (Groq/OpenRouter)** | ~30-50 MB RAM | Per-request, not constant — uses burst memory |
| **Total baseline** | **~100-200 MB RAM** | Idle state with signed-in user |

### Recommended RAM on Rumpty Cloud

| Tier | RAM | When to Use |
|------|-----|-------------|
| **Minimum** | 1 GB | Single-user hackathon demo; sufficient for demo time |
| **Recommended** | 2 GB | Comfortable margin; allows concurrent users, AI extraction calls |
| **Paid upgrade** | 4-8 GB | If you need additional services or expect many concurrent users |

**Rationale:**

- The free tier on Rumpty Cloud typically starts at **1 GB RAM** for VM instances
- Loopin's baseline is ~100-200 MB, but you need headroom for:
  - Concurrent users
  - AI extraction requests (Groq calls use burst memory)
  - Database connection pooling
  - Google OAuth token refresh operations
- **1 GB** is sufficient for a single-user hackathon demo
- **2 GB** provides comfortable margin and allows for additional features
- Rumpty Cloud's pricing scales: you can start free and upgrade as needed

---

## 7. Hackathon-Specific Tips

| Tip | Details |
|-----|---------|
| **1. Use sandbox Bachs keys** | Never use live keys during hackathon |
| **2. Free tier is generous** | 5 full-stack apps means you can test multiple variants |
| **3. Pay in naira or dollars** | Choose whichever is more convenient for you |
| **4. Eco-friendly bonus** | Rumpty Cloud runs on ~90% solar power from Lagos |
| **5. Local testing** | Use `bun dev` locally, then push to Rumpty Cloud for production |
| **6. Single-slash webhook URL** | A `//` in the URL gets a 308 from Vercel and delivery dies at the edge |
| **7. Event source → Account events** | "Connected account events" makes auto-delivery route nothing; manual Retry still works |

---

## 8. Commands to Know

```bash
# Local development
bun install
bun dev

# Build for production
bun run build

# Test cron endpoint (needs CRON_SECRET)
curl https://your-app.rumptycloud.ng/api/cron/reminders \
  -H "Authorization: Bearer $CRON_SECRET"

# Deploy to Rumpty Cloud (from console — automatic on git push)
# No CLI command needed — just push to your connected GitHub repo

# Verify deployment
open https://loopin-<hash>.rumptycloud.ng

# Local only — test extraction
echo '{"text":"Team standup Friday 9am at the office","timezone":"Africa/Lagos"}'
```

---

## 9. Need Help?

| Support Channel | Details |
|----------------|---------|
| **Rumpty Cloud** | In-app chat or email: `support@rumptycloud.ng` |
| **Loopin-specific** | Check `SETUP.md` or `AGENTS.md` in this repo |
| **Bachs payments** | Refer to `lib/bachs.ts` and `lib/payments.ts` |
| **Google OAuth** | `verification.md` has Google Cloud consent screen details |

---

## 📅 Last Updated

**October 2026** — for hackathon deployment

*Loopin v3 — AI calendar event extraction & Google Calendar sync*

---