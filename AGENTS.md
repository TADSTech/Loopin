# Notes for agents

## Payment setup — pending until the site is deployed

Bachs.io checkout is fully wired (`/api/checkout` + `/api/webhooks/bachs` +
`lib/bachs.ts`), but **no keys are configured yet**, so checkout intentionally
soft-launches: the Pricing button shows the "payments being finalised" notice
(HTTP 503 `not_configured`) while still capturing accounts. When the site is
deployed, finish setup in this order:

1. Get an API key from the Bachs Developer Portal (sandbox first, `sk_sandbox_…`)
   and set `BACHS_API_KEY` in the deployment environment.
2. Create a webhook endpoint `https://<domain>/api/webhooks/bachs` and
   subscribe to `collection.succeeded`, `checkout.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copy its signing secret to
   `BACHS_WEBHOOK_SECRET`.
3. Run the sandbox E2E: sign in → `/pricing` → Pro → pay with the Bachs test
   card. The webhook (not the redirect) must flip `public.subscriptions` to
   `plan='pro', status='active'` — check the row in Supabase and the server
   logs for `[bachs-webhook]` errors.
4. Recurring billing requires dashboard products (raw pricing = one-time
   charge): create pro/team products and set `BACHS_PRODUCT_{PRO|TEAM}_{USD|NGN}`.
5. Going live is a key swap to `sk_live_…` — the base URL is inferred from the
   key prefix. Never use live keys locally.

Coverage: `tests/bachs.test.ts` (signature verification, session input,
webhook grant mapping). Full setup guide: `SETUP.md` §6.
