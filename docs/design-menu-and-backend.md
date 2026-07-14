# Derek & Jana — shared backend + menu feature

## Why
Everything in the dashboard was browser-only `localStorage`: RSVPs, invite-sent flags,
open/click tracking. That is why tracking "cleared" (per-device, wiped on cache clear /
other device) and why a guest-facing menu picker was impossible (guests' picks on their
phones never reach the owner's tracker). Fix: one shared store.

## Store
Upstash **Redis** (Vercel Marketplace) + serverless functions in `/api`. Low-write wedding
traffic; per-guest selection writes are atomic (Redis hash field) so concurrent submits
never clobber each other.

### Env vars (set in Vercel → project → Settings → Environment Variables)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` — injected automatically when the Upstash store is connected (also accepts `UPSTASH_REDIS_REST_URL/TOKEN`).
- `ADMIN_PASSWORD` — dashboard password (moves out of page source).
- `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME` — server-side email send.

## Data model (Redis keys)
- `dj:guests` — JSON array `{id,name,email,lang,rsvp,plus,sent,manual,delivered,opened,clicked,menuSent,messageId,token}`
- `dj:rsvps`  — JSON array of public RSVP submissions
- `dj:menu`   — `{open:bool, courses:{starter:[{id,name}],main:[...],dessert:[...]}}`
- `dj:sel`    — Redis hash: field = guestId, value = `{partySize, people:[{name,starter,main,dessert}], when}`

Guests are seeded once (22-row list migrated from the old client seed); each gets a random `token`.

## API
- `GET  /api/state?pw=` (admin) → `{guests, menu, selections}` — dashboard source of truth
- `POST /api/state` (admin) → `{guests?, menu?}` overwrite — save guest edits / menu
- `GET  /api/guest?g=<token>` (public) → `{guest, menu, selection}` — menu page data
- `POST /api/rsvp` (public) → append RSVP + link to guest by email
- `POST /api/select` (public) → `{token, people[]}` → hset `dj:sel`
- `POST /api/send` (admin) → `{type:'invite'|'menu', ids?}` → Brevo send server-side, set flags

## Menu flow
1. Owner enters Starter/Main/Dessert items in dashboard → `POST /api/state {menu}`.
2. Owner clicks "Send menu email" → `POST /api/send {type:'menu'}` → attending guests get a
   personal link `https://www.derekandjana.com/?m=<token>`.
3. Guest opens link → index.html detects `?m=` → menu view: party size (prefilled from +1) +
   Starter/Main/Dessert per person + name per person → `POST /api/select`.
4. Dashboard tracker gains a **Menu** section: count per dish, subtotal per course, grand
   total, and a "still to choose" list (attending guests with no selection).

## Phases
- **P1** backend + migrate dashboard/RSVP/tracking to `/api/state` (fixes "cleared" bug).
- **P2** menu editor + guest menu view + `/api/guest` + `/api/select` + menu email + tracker section.

## Client changes (index.html)
- `getGuests/saveGuests/getR` become async API calls (admin state) instead of localStorage.
- Send buttons call `/api/send`.
- New `?m=<token>` menu view (reuses site styling).
- Dashboard: menu editor + "Send menu email" + tracker Menu section.
- Admin password check server-side (typed pw sent to API).

## Non-goals (YAGNI)
No guest accounts/login, no dietary-per-dish logic beyond a free-text note, no payments,
no realtime — a refresh button is enough.
