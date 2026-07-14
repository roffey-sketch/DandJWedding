import { Redis } from '@upstash/redis';

let _r;
// Vercel prefixes store env vars with the store name (e.g. dandJWedding_KV_REST_API_URL),
// so match by suffix rather than exact name. Exclude the read-only token.
function envBySuffix(suffix) {
  const key = Object.keys(process.env).find(
    k => k.endsWith(suffix) && !k.endsWith('READ_ONLY_' + suffix.replace(/^_/, '')) && process.env[k]
  );
  return key ? process.env[key] : undefined;
}
export function redis() {
  if (_r) return _r;
  const url = envBySuffix('KV_REST_API_URL') || envBySuffix('UPSTASH_REDIS_REST_URL');
  const token = envBySuffix('KV_REST_API_TOKEN') || envBySuffix('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) throw new Error('Redis env vars missing (need *KV_REST_API_URL / *KV_REST_API_TOKEN)');
  _r = new Redis({ url, token });
  return _r;
}

export const K = { guests: 'dj:guests', rsvps: 'dj:rsvps', menu: 'dj:menu', sel: 'dj:sel' };
export const SITE = 'https://www.derekandjana.com/';

// migrated from the old client-side seed list
const SEED = [
  ["Derek Roffey (Groom)", "", "en"],
  ["Jana Barvircakova (Bride)", "", "sk"],
  ["Darryl Roffey", "roffey@gmail.com", "en"],
  ["Viktoria Corbova-Barvircakova & Nina Corbova", "vbarvircakova@gmail.com", "sk"],
  ["Alzbeta Barvircakova", "alzbetabarvircakova@gmail.com", "sk"],
  ["Juraj Barvircak", "barvircak@gmail.com", "sk"],
  ["Maria Basova & Partner", "basovamara@gmail.com", "sk"],
  ["Eva Fidlusova", "", "en"],
  ["Karen Durbridge", "", "en"],
  ["Yvette Quelch", "yquelch1@gmail.com", "en"],
  ["Tim Quelch", "tim@timwillfixit.uk", "en"],
  ["Tamsin Quelch", "tamsinquelch@gmail.com", "en"],
  ["Taylin Quelch", "taylinquelch@gmail.com", "en"],
  ["Michael Malone O'Haloran", "mmaloneoh@gmail.com", "en"],
  ["Claire Roffey", "235claire@gmail.com", "en"],
  ["Zachary Jackson Haynes", "zach.haynes14@gmail.com", "en"],
  ["Fransonia Ruth Roffey", "francisroffey3@gmail.com", "en"],
  ["Peter White & Alex", "peterwhite23@gmail.com", "en"],
  ["Kim Pelser", "kimpelser@googlemail.com", "en"],
  ["Fiona Volmrich", "fiona@apex-planning.com", "en"],
  ["David Bishop & Julie Bishop", "david@bishopslimited.co.uk", "en"],
  ["David Roffey & Nova Roffey", "davidroffey1@gmail.com", "en"]
];

export function newToken() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 16);
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)); // ponytail: fallback, crypto exists on Vercel Node 18+
}

function seedGuests() {
  return SEED.map((s, i) => ({
    id: 100 + i, name: s[0], email: s[1], lang: s[2],
    rsvp: '', plus: '', sent: false, manual: false,
    delivered: false, opened: false, clicked: false, menuSent: false,
    messageId: null, token: newToken()
  }));
}

export async function getGuests() {
  const r = redis();
  let g = await r.get(K.guests);
  if (!Array.isArray(g) || !g.length) { g = seedGuests(); await r.set(K.guests, g); }
  // backfill tokens for any guest missing one
  let changed = false;
  for (const x of g) { if (!x.token) { x.token = newToken(); changed = true; } }
  if (changed) await r.set(K.guests, g);
  return g;
}
export async function saveGuests(g) { await redis().set(K.guests, g); }

export async function getMenu() {
  return (await redis().get(K.menu)) || { open: false, courses: { starter: [], main: [], dessert: [] } };
}
export async function saveMenu(m) { await redis().set(K.menu, m); }

export async function getSelections() { return (await redis().hgetall(K.sel)) || {}; }

export function isAdmin(req) {
  const pw = (req.query && req.query.pw) || (req.body && req.body.pw) || req.headers['x-admin-pw'];
  const expected = process.env.ADMIN_PASSWORD;
  return !!(pw && expected && pw === expected);
}

export function reply(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(obj);
}
