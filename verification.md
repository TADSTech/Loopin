# Google OAuth verification — Loopin

Working notes for submitting Loopin to Google's OAuth verification (sensitive
scope: Google Calendar). Status: **not yet submitted.**

- Console: <https://console.cloud.google.com/apis/credentials> → OAuth consent screen
- Verification center: <https://console.cloud.google.com/auth/verification>
- App: <https://loopin.tadstech.dev> · Support: `motrenewed@gmail.com`

---

## 1. Data access page — scopes to declare

Google Cloud → OAuth consent screen → **Data access** → _Add or remove scopes_
→ **Update** → **Save** → _Submit for verification_.

Declare **exactly** what the app requests — a mismatch with the code shows users
the "unverified app" screen.

| Scope                                              | Requested by                                            | Class                                 |
| -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| `openid`                                           | Supabase Google auth — **add manually**                 | non-sensitive                         |
| `https://www.googleapis.com/auth/userinfo.email`   | Supabase default                                        | non-sensitive                         |
| `https://www.googleapis.com/auth/userinfo.profile` | Supabase default                                        | non-sensitive                         |
| `https://www.googleapis.com/auth/calendar.events`  | `app/components/auth-modal.tsx`, `app/profile/page.tsx` | **sensitive → triggers verification** |

Code note: the app only ever **writes** events
(`POST /calendar/v3/calendars/{id}/events` in `lib/event-intake.ts`) — no reads.
Both OAuth calls were narrowed from `auth/calendar` → `auth/calendar.events`
so the narrowest sufficient scope is declared.

---

## 2. Prerequisites before submitting

1. **Branding** page published (app name _Loopin_, logo, app domain).
2. App information: support email `motrenewed@gmail.com`, **privacy policy**
   `https://loopin.tadstech.dev/privacy`, home page `https://loopin.tadstech.dev`.
3. **Authorized domain verified** in Google Search Console
   (`tadstech.dev` — project must be added/owned in Search Console).
4. Audience: status can stay **Testing** for now (<100 test users); move to
   **In production** once verification passes.
5. Consent screen language set to **English** (bottom-left toggle in the video).

---

## 3. Justification (paste into the verification form)

**How your app will use the requested scope:**

> Loopin turns screenshots of event flyers and messy notes into structured
> calendar events using AI. The user reviews the extracted events on screen,
> then clicks "Sync to Google Calendar". Loopin then calls the Calendar API
> `events.insert` endpoint to create those reviewed events in the user's
> calendar. The scope is requested during Sign in with Google so the
> connection is set up in one click and stored server-side with a refresh
> token (no manual token pasting).
>
> Data accessed: only the write access used to create new events the user has
> explicitly approved. Loopin does not read, display, export, store or analyse
> the user's existing calendar entries. Tokens are stored in our database
> (row-level security, HTTPS), never shared with our AI providers, never sold,
> never used for advertising or AI training. Users can revoke access at
> <https://myaccount.google.com/permissions> at any time, which stops sync
> immediately; account deletion removes stored tokens. Privacy policy:
> <https://loopin.tadstech.dev/privacy>

**Why a narrower scope is not sufficient** (prepare for this reply from Google —
if they push further, the fallback answer is that we never read calendar data
and only call `events.insert`):

> `calendar.events` is already the narrowest scope that permits the single
> operation Loopin performs (creating events). Loopin supports a
> user-designated calendar ID in Settings (not only `primary`), so the scope
> must cover event writes across the user's calendars rather than
> `calendar.events.owned` alone. Read-only alternatives (`calendar.events.owned`,
> `calendar.events.readonly`) do not permit event creation.

---

## 4. Demo video (unlisted YouTube)

### Pre-flight

1. Use a **test Google account**; first revoke Loopin at
   <https://myaccount.google.com/permissions> → Remove access, so the consent
   screen appears fresh.
2. Consent screen fields complete (see §2) and **Data access scopes = exactly
   what the consent screen shows in the video**.
3. Screen-record in **one continuous take** (OBS / Win+Alt+R). Browser zoom
   ~110%, address bar visible, cursor visible, notifications off, no cuts
   through the OAuth flow.
4. Prepare sample input: a flyer screenshot or messy notes with a future event.

### Shot list (~3–4 min)

| #   | Time      | What to show                                                                                                                                                                                                                                                                                                  |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 0:00–0:15 | `https://loopin.tadstech.dev` — "AI calendar event extraction & Google Calendar sync"                                                                                                                                                                                                                         |
| 2   | 0:15–0:40 | Paste messy notes / drop a flyer screenshot → **Extract** → event cards appear. Narrate: _user reviews everything before anything is written to their calendar_                                                                                                                                               |
| 3   | 0:40–1:40 | Click **Continue with Google** → consent screen. Hold and point at: **app name "Loopin"** (top), the **scope list**, **language = English** (bottom-left toggle), and the **address bar showing `client_id=….apps.googleusercontent.com`** — hold ≥5 s so reviewers can read it. Click **Allow** with no cuts |
| 4   | 1:40–2:00 | Back in Loopin → Profile shows "Google Calendar connected / Reconnect Google Calendar"                                                                                                                                                                                                                        |
| 5   | 2:00–2:30 | Click Sync on an extracted event → "Synced N events to Google Calendar"                                                                                                                                                                                                                                       |
| 6   | 2:30–3:00 | Open `calendar.google.com`, navigate to the event date → open the created event, show title/time/location match. **Proof of scope usage — don't skip**                                                                                                                                                        |
| 7   | 3:00–3:30 | `myaccount.google.com/permissions` → Loopin → **Remove access** → return to Loopin, shows disconnected                                                                                                                                                                                                        |

### Upload

- YouTube Studio → Upload → **Visibility: Unlisted** (private links don't open
  for reviewers) → paste the link in the verification form's YouTube field.
- If the project has **more than one OAuth client ID** (e.g. dev + prod), the
  video must show the consent flow for each.
- English audio or captions; keep it under ~5 min.

---

## 5. Submission checklist

- [ ] Data access page: 4 scopes listed above, saved
- [ ] Branding published + privacy policy URL on consent screen
- [ ] `tadstech.dev` authorized domain verified in Search Console
- [ ] Justification (§3) pasted per sensitive scope
- [ ] Unlisted video (§4) uploaded, link pasted
- [ ] Submit for verification → sensitive-scope review ~10 business days
- [ ] After approval: switch Audience status to **In production**
- [ ] Smoke test: fresh test account → sign in with Google → consent screen
      shows _Loopin_ + only the declared scopes → sync an event → it lands in
      Google Calendar
