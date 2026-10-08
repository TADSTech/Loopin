# Notes for agents

## Payment setup — sandbox complete, go-live pending

Bachs.io checkout is fully wired (`/api/checkout` + `/api/webhooks/bachs` +
`lib/bachs.ts`). **Sandbox is done**: `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`
and all six `BACHS_PRODUCT_*` ids are set in production (byte-identical to
local `.env`, which is untracked) — the sandbox E2E passed end-to-end
(webhook → `public.subscriptions` row `plan='pro', status='active'`). Ordered
list remaining for launch (full detail in `SETUP.md` §6):

1. Going live is a key swap to `sk_live_…` (base URL is inferred from the key
   prefix; never use live keys locally).
2. Recreate the webhook endpoint in live with **all seven** events:
   `collection.succeeded`, `checkout.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   (event source → **Account events**), new `whsec_…` → replace
   `BACHS_WEBHOOK_SECRET` on Vercel.
3. Recreate all 6 products in live (4 recurring + 2 trial) → replace the six
   `BACHS_PRODUCT_{PRO|TEAM}_{USD|NGN}` / `BACHS_PRODUCT_PRO_{USD|NGN}_TRIAL`
   values on Vercel.
4. Redeploy → one small real payment → payload must show
   `"mode": "subscription"` and the row must flip to `plan='pro',
status='active'`.

Rules that caused real outages: webhook URL **single slash** (a `//` = 308 at
the Vercel edge); endpoint event source must be **Account events** (Connected
account events = `Delivery attempts: 0` while manual Retry still works); the
Vercel secret must be **byte-identical** to the endpoint's signing secret.

### Free trials (7-day, new members only)

- Trials are a **product property** (`trial_period: {interval:"day",
frequency:7}` on a recurring product) — there is no trial API call. The
  trial products are `BACHS_PRODUCT_PRO_{USD|NGN}_TRIAL`; `/api/checkout`
  picks them only when `trial: true` passes a server-side eligibility check.
- Eligibility (`lib/trials.ts`): a **never-subscribed account** (no
  `subscriptions` row) **and** an **unused device** (no `trial_devices` row
  for the browser's localStorage UUID, `lib/device-id.ts`). Missing trial
  product env → 503 `trial_not_configured` — never silently falls back to a
  charged checkout.
- The webhook marks the device: `active` at trial start
  (`customer.subscription.created`, from checkout metadata), `ended` when the
  trial concludes (`invoice.paid` / `invoice.payment_failed` /
  `customer.subscription.deleted`, or the subscription leaving `trialing`).
  Existence of the row is what blocks re-trials; `status` is bookkeeping.
- Webhooks are the source of truth and write with the **admin client**
  (bypasses RLS). `subscriptions.trial_end` (set from the event, cleared when
  the trial ends) drives the profile's "Free trial ends …" line.

Coverage: `tests/bachs.test.ts` (signature verification, session input,
webhook grant mapping incl. trials), `tests/trials.test.ts` (device id +
eligibility rules). Full setup guide: `SETUP.md` §6.
