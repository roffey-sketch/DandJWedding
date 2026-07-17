# CLAUDE.md — working in this repo

Wedding site for Derek & Jana. **Read `README.md` first** for architecture, the API table,
Redis keys, and the dashboard. This file is only the stuff that will trip you up.

## Ground rules

- **One chat per project.** Only edit this repo in a session dedicated to it.
- **Never handle secrets.** `ADMIN_PASSWORD` and `BREVO_API_KEY` live in Vercel env vars.
  Don't ask for them, don't type them, don't put them in code. You therefore **cannot test the
  admin dashboard end-to-end** — verify what you can and hand the admin check to Darryl.
- **This is a live production site** people are being invited to. Verify before pushing.

## Deploying

`git push origin main` → Vercel auto-deploys (~30 s). Verify with `curl`, don't assume.

```bash
curl -s "https://www.derekandjana.com/?cb=$RANDOM" | grep -c 'yourMarker'
```

- Env var / storage changes need a **new deployment** — push an empty commit.
- `gh` may be logged in as the wrong account → push 403s. Fix:
  `gh auth switch --user ViperProBillingApp && gh auth setup-git`
  (that account is a collaborator; `roffey-sketch` is Darryl's, `Take3GlobalEvents` has no access.)

## Editing index.html

It's **one ~1.9 MB file** with megabyte base64 blobs inline. Consequences:

- **Don't read it whole.** Locate with `grep`/Python offsets, read only the slice you need.
- **Prefer Python for edits** over Edit-tool matching when touching anything near a base64 blob.
- **Always syntax-check before pushing** — a typo takes the whole site down:

```bash
python3 -c "
import re
h=open('index.html',encoding='utf-8',errors='replace').read()
big=[s for s in re.findall(r'<script\b[^>]*>(.*?)</script>', h, re.S) if 'function doLogin' in s][0]
open('/tmp/idx.js','w').write(big)
"
node --check /tmp/idx.js
```

- Copy changes: text comes from **two i18n dicts (EN + SK)** plus an inline default.
  **Change all three** or the other language silently goes stale.
- Scripts run mid-parse. Anything referencing DOM **after** the `<script>` (e.g. `#menuview`)
  must wait for `DOMContentLoaded` — this exact bug broke the menu links once.

## Verifying

Local preview: `python3 -m http.server` in the repo, then drive the browser.
**`/api/*` won't exist locally** — either point at production or stub `apiGet`/`apiPost` in the
console with mock data (that's how the menu view and PDF export were verified).

Non-destructive prod smoke tests:

```bash
curl -s "https://www.derekandjana.com/api/guest?g=__probe__"   # {"error":"not found"} = Redis healthy
curl -s "https://www.derekandjana.com/api/state?pw=wrong"      # {"error":"unauthorized"} = auth works
```

Don't POST test data to `/api/rsvp` on prod — it lands in Darryl's dashboard.

## Gotchas that bite

- **Redis env vars are prefixed** (`dandJWedding_KV_REST_API_URL`). `api/_lib.js` matches by
  **suffix** — keep it that way.
- **Guests seed once**, when `dj:guests` is empty. Don't add client-side seeding back; the server owns it.
- The menu tracker **counts dishes that are no longer on the menu** — deliberate, so a real guest's
  pick can't silently vanish. "Clear all menu choices" wipes `dj:sel`.
- **Emails must use web-safe fonts** (Arial/Georgia). The design linter flags Arial here — it's a
  false positive; mail clients ignore web fonts. Don't "fix" it.
- Client keeps a `STATE` cache loaded at login; getters (`getGuests`/`getR`) stay **synchronous**,
  writes persist via the API. Don't make the getters async — it ripples everywhere.
- Dashboard's Brevo/sender/endpoint boxes are **dead** (server env vars are used). Safe to delete.
- `invite.jpg` was rendered from the site's own hero markup via headless Chrome, not hand-made:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --screenshot=...`
  (ImageMagick can't render the fonts here.)

## Style

Ponytail: shortest diff that works, no speculative abstractions, prefer native platform features
(the PDF export is `window.print()`, not a PDF library). Mark deliberate shortcuts with a
`ponytail:` comment naming the ceiling.
