# Rebuild loopin_pitch_deck.html — brand colors, responsiveness, richer visuals

**Scope:** `loopin_pitch_deck.html` only (user declined updating `public/pitch-deck.html`).
**Theme:** Light Material theme matching the app, with dark (#131314) accent slides for Hook and Finale.
**Target:** Desktop presentation tomorrow — must look right at 1920×1080 and 1280×720, fullscreen, keyboard-driven.

## Problems found (diagnosis)

1. **Wrong visual identity.** The deck is "minimalist brutalist": grey paper `#fafafa`, hard 1px black borders, mono accents. The actual app (`app/globals.css`) is Google-Material: white surfaces, primary `#0b57d0`, soft-blue tints `#e8f0fe`/`#c6dafc`, muted `#5f6368`, borders `#e5e7eb`/`#dadce0`, Roboto, pill buttons, rounded cards, soft elevation — no black borders anywhere.
2. **Responsiveness / presentation layout.** Slides are not viewport-fitted; sticky header (56px) + footer eat vertical space so content-heavy slides (Problem, Build, Features) overflow a 1080p/720p presentation window. `.stage-row` never goes two-column (slides omit `stage-row-2` classes), so head-block + content stack and get tall. Top bar gets crowded (2 pills + fullscreen + JS-appended prev/next). `.tech` cards use undefined `--space-5` (invalid padding).
3. **Too minimalist.** Flat grey cards, no icons-in-chips, no color coding, no elevation, no gradient — none of the app's soft-blue chip / logo-circle character is present.
4. **Broken content/JS.**
   - Pricing slide markup doesn't match its own CSS: markup uses `.tag`/`.amount`, CSS styles `.price-tier`/`.price` → slide renders unstyled.
   - `setCurrency()` is a no-op (both branches write `"$0 / ₦0"`).
   - Space key handler fires even when a button is focused (double-advance).
   - QR fallback `onerror` chain is fragile; `.qrcode` aspect-ratio `1/.45` squashes the code.

## Plan

### 1. Restructure layout for desktop presentation
- Each slide becomes a viewport stage: `min-height: calc(100dvh - chrome)`; content vertically centered, fits without page scroll at 1920×1080 and 1280×720; small viewports fall back to normal scroll.
- Slim sticky top bar only (drop footer from presentation flow — move legal links into a tiny bottom strip inside the bar or remove): brand (soft-blue circle + infinity glyph + "loopin" wordmark), slide counter pill, prev/next pill buttons (static HTML, not JS-injected), fullscreen button, thin progress bar under the bar.
- Keyboard: ←/→, Space (ignored when focus is on a control), `f` for fullscreen.

### 2. Rebrand tokens to match `app/globals.css`
- Replace `:root` with app tokens: `--primary:#0b57d0`, `--primary-soft:#e8f0fe`, `--primary-border:#c6dafc`, `--surface:#fff`, `--surface-muted:#f1f3f4`, `--border:#e5e7eb`, `--border-strong:#dadce0`, `--ink:#1f1f1f`, `--muted:#5f6368`, dark pair `#131314/#e8eaed/#8ab4f8`.
- Load **Roboto** (400/500/700) from Google Fonts CDN; display = Roboto 700 tight tracking.
- Pill buttons `border-radius:999px`, cards `rounded-2xl` (~16px), soft elevation `0 1px 6px rgba(32,33,36,.18)`, `::selection` soft blue. No hard black borders.

### 3. Richer (non-minimal) visuals
- **Hook + Finale** = dark slides (`#131314` bg, `#e8eaed` text, `#8ab4f8` accents, blue gradient glow).
- Feature/pain/step/tech cards get colored soft icon chips (Google palette: blue `#0b57d0`, red `#d93025`, green `#0f9d58`, yellow `#f9ab00`, purple `#ab47bc` on `*-soft` backgrounds), rounded icon tiles, soft-blue eyebrow chips like the app's status badges.
- Contrast slide: Old = `#fce8e6` error-tinted column, New = `#e8f0fe` primary-tinted column.
- Bigger display type, soft gradient accents on section headers, pricing Pro card elevated with primary border + "Most popular" pill.

### 4. Fix bugs
- Rewrite pricing slide markup to match styled classes (tier label, big price, feature list with check chips, popular badge); implement real USD/NGN toggle (per-card data attributes: Free `$0`/`₦0`, Pro `$5`/`₦7,500`, Team `$19`/`₦28,500`).
- Fix `--space-5` → defined token; fix QR to square box + correct `onerror` fallback to `loopin.tadstech.dev`; keyboard handler ignores events when `e.target` is button/link/input.
- Keep the extraction simulator but size it to fit the viewport stage.

### 5. Verify
- Open the file in a headless browser at 1920×1080, 1280×720, and ~800×600; screenshot every slide (all 10), confirm no overflow/clipping, brand colors, pricing render, currency toggle, keyboard nav, demo simulator.
- Self-check against the actual `app/globals.css` tokens.

## Not in scope
- `public/pitch-deck.html` (leave untouched per user).
- Live site / app code changes.
