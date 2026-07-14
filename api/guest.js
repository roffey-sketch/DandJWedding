import { getGuests, getMenu, getSelections, reply } from './_lib.js';

// Public: menu-page data for one guest, keyed by their private token.
export default async function handler(req, res) {
  try {
    const token = req.query && req.query.g;
    if (!token) return reply(res, 400, { error: 'missing token' });
    const guests = await getGuests();
    const g = guests.find(x => x.token === token);
    if (!g) return reply(res, 404, { error: 'not found' });
    const [menu, sels] = await Promise.all([getMenu(), getSelections()]);
    return reply(res, 200, {
      guest: { id: g.id, name: g.name, lang: g.lang, rsvp: g.rsvp, plus: g.plus || '' },
      menu,
      selection: sels[g.id] || null
    });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
