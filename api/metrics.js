import { getGuests, saveGuests, isAdmin, reply } from './_lib.js';

// Admin: pull Brevo open/click/delivery events for each sent guest and update flags.
export default async function handler(req, res) {
  if (!isAdmin(req)) return reply(res, 401, { error: 'unauthorized' });
  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' });
  const key = process.env.BREVO_API_KEY;
  if (!key) return reply(res, 400, { error: 'BREVO_API_KEY not set' });
  try {
    const guests = await getGuests();
    let checked = 0;
    // Check every guest with an email: if Brevo has any event for them, the invite
    // was sent — so this also RECONSTRUCTS sent/tracking after the Redis migration
    // re-seeded the guest list (the real send record lives in Brevo).
    for (const g of guests.filter(x => x.email)) {
      try {
        const r = await fetch(
          'https://api.brevo.com/v3/smtp/statistics/events?limit=100&sort=desc&email=' + encodeURIComponent(g.email),
          { headers: { 'api-key': key, 'Accept': 'application/json' } }
        );
        if (!r.ok) continue;
        const data = await r.json();
        const events = data.events || [];
        if (events.length && !g.manual) { g.sent = true; g.manual = false; }
        for (const ev of events) {
          const e = String(ev.event || '').toLowerCase();
          if (e.includes('deliver')) g.delivered = true;
          if (e.includes('open')) g.opened = true;
          if (e.includes('click')) g.clicked = true;
        }
        checked++;
      } catch (e) { /* skip this guest */ }
    }
    await saveGuests(guests);
    return reply(res, 200, { ok: true, checked });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
