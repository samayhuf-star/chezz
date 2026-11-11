const L = require('./_lib.js');
const crypto = require('crypto');
const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,255}\.[^\s@<>]{2,}$/;
const newDoc = (name) => ({ id: crypto.randomBytes(8).toString('hex'), name, city: '', state: '', country: '', points: 0, w: 0, l: 0, d: 0, best: 0, games: 0, beaten: [], claimed: [], created: Date.now() });
const reply = (res, doc, secret) => res.status(200).json({ id: doc.id, secret, doc: L.myDoc(doc) });
const addSession = (doc) => { const s = crypto.randomBytes(16).toString('hex'); doc.sessions = (doc.sessions || []).concat(L.sha(s)).slice(-5); return s; };

// guest | register | login  (guests can later register to keep their stats)
module.exports = L.handler('POST', async (req, res, b) => {
  const mode = b.mode;
  if (mode === 'guest') {
    const doc = newDoc('Guest ' + (1000 + crypto.randomInt(9000)));
    const secret = crypto.randomBytes(16).toString('hex'); doc.secretHash = L.sha(secret);
    await L.savePlayer(doc);
    return reply(res, doc, secret);
  }
  if (mode === 'delete') { // permanent account deletion (App Store requirement for apps with account creation)
    const doc = await L.loadPlayer(b.id);
    if (!L.authOK(doc, b.secret)) return res.status(403).json({ error: 'Not signed in' });
    if (doc.email) await L.store.delJSON(L.emailKey(doc.email));
    await L.store.delJSON('players/' + doc.id + '.json');
    return res.status(200).json({ deleted: true });
  }
  const email = String(b.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  const pw = String(b.password || '');
  if (mode === 'register') {
    if (pw.length < 8 || pw.length > 100) return res.status(400).json({ error: 'Password must be 8–100 characters' });
    if (await L.store.getJSON(L.emailKey(email))) return res.status(409).json({ error: 'That email already has an account – sign in instead' });
    let doc = null, secret;
    if (b.id) { // upgrade the guest account this device is using, keeping its stats
      doc = await L.loadPlayer(b.id);
      if (!L.authOK(doc, b.secret)) return res.status(403).json({ error: 'Not signed in' });
      if (doc.email) return res.status(400).json({ error: 'This account already has an email' });
      secret = b.secret;
    } else {
      doc = newDoc(L.clean(email.split('@')[0], 24) || 'Player');
      secret = crypto.randomBytes(16).toString('hex'); doc.secretHash = L.sha(secret);
    }
    const salt = crypto.randomBytes(16).toString('hex');
    doc.email = email; doc.pwSalt = salt; doc.pwHash = await L.hashPw(pw, salt);
    await L.savePlayer(doc);
    await L.store.putJSON(L.emailKey(email), { id: doc.id });
    return reply(res, doc, secret);
  }
  if (mode === 'login') {
    const ref = await L.store.getJSON(L.emailKey(email));
    const doc = ref && await L.loadPlayer(ref.id);
    const bad = () => res.status(401).json({ error: 'Wrong email or password' });
    if (!doc || !doc.pwHash) return bad();
    if (doc.lockUntil && Date.now() < doc.lockUntil) return res.status(429).json({ error: 'Too many wrong attempts. Try again in a few minutes.' });
    const h = await L.hashPw(pw, doc.pwSalt);
    const a = Buffer.from(h), c = Buffer.from(doc.pwHash);
    if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) {
      doc.fails = (doc.fails | 0) + 1;
      if (doc.fails >= 8) { doc.lockUntil = Date.now() + 10 * 60 * 1000; doc.fails = 0; }
      await L.savePlayer(doc); return bad();
    }
    doc.fails = 0; doc.lockUntil = 0;
    const secret = addSession(doc); await L.savePlayer(doc);
    return reply(res, doc, secret);
  }
  res.status(400).json({ error: 'Bad request' });
});
