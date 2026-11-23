// Sign in with Apple on the server, with a locally generated key pair standing in for Apple's keys.
process.env.STORE = 'mem'; process.env.CHESS_SECRET = 't';
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
globalThis.__APPLE_JWKS = [Object.assign(publicKey.export({ format: 'jwk' }), { kid: 'test1', alg: 'RS256', use: 'sig' })];
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(over = {}, key = privateKey, kid = 'test1') {
  const now = Math.floor(Date.now() / 1000), body = b64({ alg: 'RS256', kid }) + '.' + b64(Object.assign({ iss: 'https://appleid.apple.com', aud: 'com.samayvashsht.chezz', exp: now + 600, iat: now, sub: '001234.abc' }, over));
  return body + '.' + crypto.sign('RSA-SHA256', Buffer.from(body), key).toString('base64url');
}
const call = (m, body) => new Promise(r => { const res = { status(c) { this.c = c; return this; }, json(o) { r({ c: this.c || 200, o }); }, setHeader() {} }; require('../api/' + m)({ method: 'POST', body, query: {} }, res); });
let bad = 0; const ok = (n, c) => { console.log(c ? 'ok  ' : 'FAIL', n); if (!c) bad++; };
(async () => {
  const a = await call('auth', { mode: 'apple', identityToken: token(), name: 'Asha Rao' });
  ok('valid Apple token creates an account with the given name', a.c === 200 && a.o.doc.name === 'Asha Rao' && a.o.doc.apple === true && a.o.doc.guest === false && !!a.o.secret);
  const b = await call('auth', { mode: 'apple', identityToken: token() });
  ok('same Apple user signs back in to the same account', b.c === 200 && b.o.id === a.o.id && b.o.secret !== a.o.secret);
  ok('the new session works', (await call('profile', { id: b.o.id, secret: b.o.secret })).c === 200);
  ok('wrong app (audience) rejected', (await call('auth', { mode: 'apple', identityToken: token({ aud: 'com.evil.app' }) })).c === 401);
  ok('wrong issuer rejected', (await call('auth', { mode: 'apple', identityToken: token({ iss: 'https://example.com' }) })).c === 401);
  ok('expired token rejected', (await call('auth', { mode: 'apple', identityToken: token({ exp: Math.floor(Date.now() / 1000) - 5 }) })).c === 401);
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  ok('token signed by someone else rejected', (await call('auth', { mode: 'apple', identityToken: token({}, other) })).c === 401);
  ok('unknown key id rejected', (await call('auth', { mode: 'apple', identityToken: token({}, privateKey, 'nope') })).c === 401);
  const t = token().split('.'); t[1] = b64({ iss: 'https://appleid.apple.com', aud: 'com.samayvashsht.chezz', exp: 9999999999, sub: 'someone-else' });
  ok('tampered claims rejected', (await call('auth', { mode: 'apple', identityToken: t.join('.') })).c === 401);
  ok('garbage rejected', (await call('auth', { mode: 'apple', identityToken: 'x.y.z' })).c === 401 && (await call('auth', { mode: 'apple' })).c === 401);
  const g = await call('auth', { mode: 'guest' });
  const up = await call('auth', { mode: 'apple', identityToken: token({ sub: 'second.user' }), id: g.o.id, secret: g.o.secret, name: 'Kabir' });
  ok('guest who signs in with Apple keeps the same account and gets their name', up.c === 200 && up.o.id === g.o.id && up.o.doc.guest === false && up.o.doc.name === 'Kabir');
  ok('deleting the account frees the Apple link', (await call('auth', { mode: 'delete', id: up.o.id, secret: up.o.secret })).c === 200 && (await call('auth', { mode: 'apple', identityToken: token({ sub: 'second.user' }) })).o.id !== g.o.id);
  process.exit(bad ? 1 : 0);
})();
