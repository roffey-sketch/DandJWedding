import { getGuests, saveGuests, isAdmin, reply, newToken, SITE } from './_lib.js';

const esc = s => String(s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

function inviteEmail(g) {
  const sk = g.lang === 'sk';
  const hi = sk ? `Milá/Milý ${esc(g.name)},` : `Dear ${esc(g.name)},`;
  const btn = sk ? 'ZOBRAZIŤ POZVÁNKU A ODPOVEDAŤ' : 'VIEW INVITATION & RSVP';
  const rsvp = sk ? 'Odpovedzte prosím do utorka 28. júla 2026 na www.derekandjana.com'
    : 'Kindly reply by Tuesday 28 July 2026 at www.derekandjana.com';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F1ECE1">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1ECE1;padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:0 0 14px;font-family:Georgia,serif;color:#22392E;font-size:17px">${hi}</td></tr>
  <tr><td align="center"><a href="${SITE}"><img src="${SITE}invite.jpg" width="600" alt="Derek &amp; Jana — 11 August 2026, Lewes, England" style="display:block;width:100%;max-width:600px;border:0;border-radius:6px"></a></td></tr>
  <tr><td align="center" style="padding:26px 0 8px"><a href="${SITE}" style="display:inline-block;padding:16px 34px;border:1px solid #22392E;border-radius:40px;color:#22392E;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-decoration:none">${btn}</a></td></tr>
  <tr><td align="center" style="padding:6px 0 30px;font-family:Arial,sans-serif;color:#8a8574;font-size:12px;letter-spacing:1px">${rsvp}</td></tr>
  </table></td></tr></table></body></html>`;
}

function menuEmail(g) {
  const sk = g.lang === 'sk';
  const link = `${SITE}?m=${encodeURIComponent(g.token)}`;
  const hi = sk ? `Milá/Milý ${esc(g.name)},` : `Dear ${esc(g.name)},`;
  const intro = sk
    ? 'Tešíme sa na Vás na našom svadobnom obede v Pelham House. Vyberte si prosím jedlá pre svoj stôl.'
    : 'We can’t wait to celebrate with you at our wedding lunch at Pelham House. Please choose your dishes for your party.';
  const btn = sk ? 'VYBRAŤ JEDLÁ' : 'CHOOSE YOUR MENU';
  const note = sk ? 'Odkaz je jedinečný pre Vás.' : 'This link is unique to you.';
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F1ECE1">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1ECE1;padding:24px 0"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:0 0 10px;font-family:Georgia,serif;color:#22392E;font-size:20px;letter-spacing:2px">Derek &amp; Jana</td></tr>
  <tr><td align="center" style="padding:0 0 16px;font-family:Georgia,serif;color:#22392E;font-size:17px">${hi}</td></tr>
  <tr><td align="center" style="padding:0 30px 20px;font-family:Georgia,serif;color:#4a5a50;font-size:15px;line-height:1.6">${intro}</td></tr>
  <tr><td align="center" style="padding:6px 0 12px"><a href="${link}" style="display:inline-block;padding:16px 34px;background:#22392E;border-radius:40px;color:#F1ECE1;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-decoration:none">${btn}</a></td></tr>
  <tr><td align="center" style="padding:2px 0 30px;font-family:Arial,sans-serif;color:#8a8574;font-size:11px;letter-spacing:1px">${note}</td></tr>
  </table></td></tr></table></body></html>`;
}

function subjectFor(type, g) {
  const sk = g.lang === 'sk';
  if (type === 'menu') return sk ? 'Vyberte si svadobné menu — Derek a Jana' : 'Choose your wedding menu — Derek & Jana';
  return sk ? 'Derek a Jana sa berú — 11. augusta 2026 · Lewes' : 'Derek & Jana are getting married — 11 August 2026 · Lewes';
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return reply(res, 401, { error: 'unauthorized' });
  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' });
  try {
    const b = req.body || {};
    const type = b.type === 'menu' ? 'menu' : 'invite';
    const key = process.env.BREVO_API_KEY;
    const from = { email: process.env.SENDER_EMAIL, name: process.env.SENDER_NAME || 'Derek & Jana' };
    if (!key || !from.email) return reply(res, 400, { error: 'Brevo not configured (BREVO_API_KEY, SENDER_EMAIL)' });

    const guests = await getGuests();
    let targets;
    if (Array.isArray(b.ids) && b.ids.length) targets = guests.filter(g => b.ids.includes(g.id) && g.email);
    else if (type === 'menu') targets = guests.filter(g => g.rsvp === 'yes' && g.email);
    else targets = guests.filter(g => !g.sent && g.email);

    const results = [];
    for (const g of targets) {
      if (!g.token) g.token = newToken();
      const html = type === 'menu' ? menuEmail(g) : inviteEmail(g);
      try {
        const r = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': key, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            sender: from, to: [{ email: g.email, name: g.name }],
            subject: subjectFor(type, g), htmlContent: html, tags: ['dj-' + type]
          })
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) {
          if (type === 'menu') g.menuSent = true;
          else { g.sent = true; g.manual = false; g.messageId = data.messageId || null; }
          results.push({ id: g.id, ok: true });
        } else {
          results.push({ id: g.id, ok: false, error: data.message || ('HTTP ' + r.status) });
        }
      } catch (e) {
        results.push({ id: g.id, ok: false, error: String(e && e.message || e) });
      }
    }
    await saveGuests(guests);
    const sent = results.filter(x => x.ok).length;
    return reply(res, 200, { sent, total: targets.length, results });
  } catch (e) {
    return reply(res, 500, { error: String(e && e.message || e) });
  }
}
