// Sign in with Apple, server side: checks the identity token the app receives from Apple.
// The token is a JWT signed by Apple (RS256). We verify the signature against Apple's published keys and
// check who issued it, which app it is for and that it has not expired. Returns the token's claims or null.
const crypto = require('crypto');
const ISSUER = 'https://appleid.apple.com', KEYS_URL = 'https://appleid.apple.com/auth/keys';
const audiences = () => (process.env.APPLE_AUDIENCE || 'com.samayvashsht.chezz').split(',').map(s => s.trim()).filter(Boolean);
let cache = { t: 0, keys: null };
async function appleKeys() {
  if (globalThis.__APPLE_JWKS) return globalThis.__APPLE_JWKS; // tests supply their own key set
  if (cache.keys && Date.now() - cache.t < 6 * 3600 * 1000) return cache.keys;
  const r = await fetch(KEYS_URL); if (!r.ok) throw new Error('Could not reach Apple');
  cache = { t: Date.now(), keys: (await r.json()).keys || [] };
  return cache.keys;
}
const b64 = s => Buffer.from(String(s), 'base64url');
async function verifyAppleToken(token) {
  if (typeof token !== 'string' || token.length > 5000) return null;
  const parts = token.split('.'); if (parts.length !== 3) return null;
  let head, claims; try { head = JSON.parse(b64(parts[0]).toString()); claims = JSON.parse(b64(parts[1]).toString()); } catch (e) { return null; }
  if (!head || head.alg !== 'RS256' || !claims) return null;
  const jwk = (await appleKeys()).find(k => k.kid === head.kid && k.kty === 'RSA'); if (!jwk) return null;
  const subtle = crypto.webcrypto.subtle, alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const key = await subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, alg, false, ['verify']);
  if (!(await subtle.verify(alg, key, b64(parts[2]), Buffer.from(parts[0] + '.' + parts[1])))) return null;
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER || !audiences().includes(claims.aud) || !(claims.exp > now) || typeof claims.sub !== 'string' || !claims.sub) return null;
  return claims;
}
module.exports = { verifyAppleToken };
