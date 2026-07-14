import { getGuests, saveGuests, redis, K, reply } from './_lib.js';

// Public: an RSVP submitted from the site. Appends to the list and, when the email
// matches a known guest, updates that guest's rsvp/plus so the dashboard reflects it.
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' });
  try {
    const b = req.body || {};
    const rec = {
      name: String(b.name || '').slice(0, 120),
      email: String(b.email || '').slice(0, 160),
      attending: b.attending === 'yes' ? 'yes' : 'no',
      plus: String(b.plus || '').slice(0, 120),
      diet: String(b.diet || '').slice(0, 300),
      msg: String(b.msg || '').slice(0, 1000),
      lang: b.lang === 'sk' ? 'sk' : 'en',
      when: new Date().toISOString()
    };
    const list = (await redis().get(K.rsvps)) || [];
    list.push(rec);
    await redis().set(K.rsvps, list);
    if (rec.email) {
      const guests = await getGuests();
      const g = guests.find(x => x.email && x.email.toLowerCase() === rec.email.toLowerCase());
      if (g) { g.rsvp = rec.attending; g.plus = rec.plus; await saveGuests(guests); }
    }
    return reply(res, 200, { ok: true });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
