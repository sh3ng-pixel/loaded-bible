// Cloudflare Pages Function: POST /api/ai
// Checks that the person is signed in (Firebase), then asks Claude and streams the answer back.
// Needs these environment variables in Cloudflare: ANTHROPIC_API_KEY (secret), FIREBASE_API_KEY
// Optional: MODEL, MODEL_QUICK, DAILY_LIMIT and a KV namespace bound as LIMITS.
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'Please sign in to use the ✨ features.' }, 401);

  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  const lj = await look.json().catch(() => ({}));
  const uid = lj.users && lj.users[0] && lj.users[0].localId;
  if (!look.ok || !uid) return json({ error: 'Your sign-in has expired. Please sign in again.' }, 401);

  let body; try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) return json({ error: 'Bad request' }, 400);

  if (env.LIMITS) { // optional daily limit per person
    const key = `${uid}:${new Date().toISOString().slice(0, 10)}`;
    const used = parseInt(await env.LIMITS.get(key) || '0', 10);
    const limit = parseInt(env.DAILY_LIMIT || '60', 10);
    if (used >= limit) return json({ error: `You've used today's ${limit} ✨ requests. Come back tomorrow!` }, 429);
    await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  }

  const model = body.tier === 'quick' ? (env.MODEL_QUICK || 'claude-haiku-5-5') : (env.MODEL || 'claude-sonnet-5-5');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, stream: true, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) {
    const t = await r.text();
    console.log('Anthropic error', r.status, t.slice(0, 500));
    return json({ error: r.status === 429 ? 'The AI helper is busy — try again in a minute.' : 'The AI helper had a problem. Please try again.' }, r.status === 429 ? 429 : 502);
  }
  return new Response(r.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
