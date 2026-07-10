// Single-user session: an HMAC-signed expiry timestamp in a cookie.
// Web Crypto only, so it runs in the proxy (edge) as well as Node.

const COOKIE = 'vivy_session';

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.AUTH_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSessionValue(days = 30): Promise<string> {
  const exp = Date.now() + days * 24 * 60 * 60 * 1000;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function verifySessionValue(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  return (await hmac(exp)) === sig;
}

export const SESSION_COOKIE = COOKIE;
