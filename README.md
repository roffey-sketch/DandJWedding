# Derek & Jana — wedding site

Live: **https://www.derekandjana.com** · Repo: `roffey-sketch/DandJWedding` · Host: Vercel project `derekandjana-v14`

Bilingual (EN/SK) wedding site with an RSVP dashboard, invitations, and menu selection.
**11 August 2026 · Pelham House, St. Andrews Lane, Lewes, BN7 1UW.**

## Layout

| File | What |
|---|---|
| `index.html` | The whole site + dashboard, single self-contained file (CSS/JS/images inline as base64) |
| `story.mp4` | Our Story video (~50 MB) |
| `music.mp3` | Background music |
| `invite.jpg` | Email invitation image (floral hero + monogram) |
| `api/*.js` | Vercel serverless functions |
| `package.json` | Makes it a functions project (`@upstash/redis`) |

## Deploying

Push to `main` → Vercel auto-deploys. That's it.

> Env var / storage changes only apply to a **new** deployment — push an empty commit to pick them up.

## Backend

Upstash **Redis** + serverless functions. Everything shared lives server-side (this is why
invite tracking no longer "clears" — it used to be per-browser `localStorage`).

**Redis keys:** `dj:guests` (array) · `dj:rsvps` (array) · `dj:menu` (`{open,courses:{starter,main,dessert}}`) · `dj:sel` (hash: guestId → `{partySize,people[]}`)

**API**

| Route | Auth | Purpose |
|---|---|---|
| `GET/POST /api/state` | admin | Dashboard read/write (guests, rsvps, menu; `clearSelections:true` wipes picks) |
| `GET /api/guest?g=<token>` | public | Menu-page data for one guest |
| `POST /api/rsvp` | public | RSVP capture, links to guest by email |
| `POST /api/select` | public | Guest menu choices (atomic per-guest hash write) |
| `POST /api/send` | admin | Brevo send — `{type:'invite'\|'menu', ids?, preview?}` |
| `POST /api/metrics` | admin | Pull Brevo events → sent/delivered/opened/clicked |

**Env vars** (Vercel → Settings → Environment Variables):
`ADMIN_PASSWORD`, `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, plus the store's
`dandJWedding_KV_REST_API_URL` / `_TOKEN` (matched by *suffix* in `api/_lib.js`, so any prefix works).

## Dashboard (Login, top-right)

Password = `ADMIN_PASSWORD`, checked server-side. Guests seed automatically on first load (22 people).

- **Guest list** — edit name/email/lang, set RSVP, Send/Resend invite, Preview, per-guest **Send menu**
- **Wedding menu** — one dish per line per course → **Save menu**
  - **Preview menu email** · **Send menu email to attending** · **Export final menu selections** · **Clear all menu choices**
- **Menu order** — dish counts, per-course subtotals, still-to-choose list
- **Refresh metrics** — pulls Brevo events; also *reconstructs* Sent status from Brevo's record

### Menu flow
Enter menu → Save → Send menu email → guest opens their personal link `?m=<token>` →
sets party size (prefilled from their +1) + picks per person → tracker counts it.

### Export
"Export final menu selections" opens a print-ready page (**Save as PDF**): order counts on top,
allergies in bold, then per-guest selections. Uses native print — no PDF dependency.

## Editing site copy

Text lives in **two i18n dicts** (EN + SK) in the JS; `data-i18n="key"` elements are filled on load.
**Change both dicts** (and the inline default) or the other language goes stale.

Key hooks: `#videowrap` (Our Story video + play button) · `.art-photo2` (couple photo, base64) ·
`.art-photo` (venue) · floral hero background.

## Gotchas

- Emails must use web-safe fonts (Arial/Georgia) — mail clients ignore web fonts.
- The tracker counts a picked dish **even if it's no longer on the menu**, so real picks can't
  silently vanish when you edit the menu. Use **Clear all menu choices** to remove test picks.
- Dashboard "Brevo key / sender / endpoint" boxes are **dead** — the server uses env vars.
- `invite.jpg` was rendered from the site's own hero markup via headless Chrome (see git history).
