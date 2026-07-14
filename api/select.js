import { getGuests, getSelections, redis, K, reply } from './_lib.js';

// Public: a guest submits their party's menu choices (keyed by token).
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' });
  try {
    const b = req.body || {};
    const guests = await getGuests();
    const g = guests.find(x => x.token === b.token);
    if (!g) return reply(res, 404, { error: 'not found' });
    const menu = null; // items are free-form ids/names chosen client-side; store as given
    const people = (Array.isArray(b.people) ? b.people : []).slice(0, 20).map(p => ({
      name: String(p && p.name || '').slice(0, 80),
      starter: String(p && p.starter || '').slice(0, 120),
      main: String(p && p.main || '').slice(0, 120),
      dessert: String(p && p.dessert || '').slice(0, 120)
    }));
    if (!people.length) return reply(res, 400, { error: 'no selections' });
    const rec = { partySize: people.length, people, when: new Date().toISOString() };
    // Redis hash field = atomic per-guest write; concurrent guests never clobber each other.
    await redis().hset(K.sel, { [g.id]: rec });
    return reply(res, 200, { ok: true });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
