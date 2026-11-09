// GET /api/tiktok/callback — TikTok sends the person back here. We check who they are,
// then make a Firebase sign-in token so they get a normal Loaded Bible account.
// Needs: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, FIREBASE_SERVICE_ACCOUNT (the whole JSON key file)
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const fail = m => new Response(null, { status: 302, headers: { Location: `${url.origin}/#tterr=${encodeURIComponent(m)}` } });
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  const saved = ((request.headers.get('Cookie') || '').match(/(?:^|;\s*)tt_state=([^;]+)/) || [])[1];
  if (!code || !state || state !== saved) return fail('TikTok sign-in was cancelled or expired. Please try again.');
  try {
    const tr = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, code,
        grant_type: 'authorization_code', redirect_uri: `${url.origin}/api/tiktok/callback` })
    });
    const tj = await tr.json();
    if (!tj.access_token) return fail('TikTok sign-in failed. Please try again.');
    const ur = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name', {
      headers: { Authorization: 'Bearer ' + tj.access_token } });
    const uj = await ur.json().catch(() => ({}));
    const u = (uj.data && uj.data.user) || {};
    const openId = u.open_id || tj.open_id;
    if (!openId) return fail('TikTok sign-in failed. Please try again.');
    const token = await firebaseCustomToken(env, 'tiktok:' + openId, { provider: 'tiktok' });
    const h = new URLSearchParams({ tt: token, n: u.display_name || '', a: u.avatar_url || '' });
    return new Response(null, { status: 302, headers: {
      Location: `${url.origin}/#${h}`,
      'Set-Cookie': 'tt_state=; Path=/api/tiktok; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });
  } catch (e) {
    console.log('TikTok callback error', e && e.message);
    return fail('TikTok sign-in failed. Please try again.');
  }
}

async function firebaseCustomToken(env, uid, claims) {
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const data = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 3600, uid, claims });
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return data + '.' + b64url(new Uint8Array(sig));
}
function b64url(bytes) { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
