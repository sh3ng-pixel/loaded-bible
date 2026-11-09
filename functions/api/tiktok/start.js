// GET /api/tiktok/start — sends the person to TikTok to log in.
// Needs: TIKTOK_CLIENT_KEY
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.TIKTOK_CLIENT_KEY) return new Response('TikTok login is not set up yet.', { status: 500 });
  const state = crypto.randomUUID().replace(/-/g, '');
  const p = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY, scope: 'user.info.basic', response_type: 'code',
    redirect_uri: `${url.origin}/api/tiktok/callback`, state
  });
  return new Response(null, { status: 302, headers: {
    Location: 'https://www.tiktok.com/v2/auth/authorize/?' + p,
    'Set-Cookie': `tt_state=${state}; Path=/api/tiktok; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
  }});
}
