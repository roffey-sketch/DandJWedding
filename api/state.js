import { getGuests, saveGuests, getMenu, saveMenu, getSelections, getRsvps, saveRsvps, isAdmin, reply } from './_lib.js';

export default async function handler(req, res) {
  if (!isAdmin(req)) return reply(res, 401, { error: 'unauthorized' });
  try {
    if (req.method === 'GET') {
      const [guests, menu, selections, rsvps] = await Promise.all([getGuests(), getMenu(), getSelections(), getRsvps()]);
      return reply(res, 200, { guests, menu, selections, rsvps });
    }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (Array.isArray(b.guests)) await saveGuests(b.guests);
      if (Array.isArray(b.rsvps)) await saveRsvps(b.rsvps);
      if (b.menu) await saveMenu(b.menu);
      return reply(res, 200, { ok: true });
    }
    return reply(res, 405, { error: 'method not allowed' });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
