// Loaded Bible — personal edition.
// Serves the website from /public and runs the ✨ AI helper (with daily limits so nobody can run up your bill).
// Progress is saved on each device (in the browser).
// Cloudflare secret needed (Settings → Variables and Secrets):
//   ANTHROPIC_API_KEY  for the ✨ features
// Optional: MODEL, MODEL_QUICK, DAILY_LIMIT (per person, default 80), DAILY_TOTAL (whole site, default 300)

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const KEY_RE = /^[A-Za-z0-9_.:@+~-]{1,120}$/;
const MAX_FAILS = 8, WINDOW_MS = 15 * 60 * 1000;

export class Store {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const url = new URL(request.url);
    const st = this.ctx.storage;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    switch (url.pathname) {
      case '/check': { // rate-limited code check
        const k = 'rl:' + (body.ip || 'x');
        const rec = (await st.get(k)) || { n: 0, t: Date.now() };
        if (Date.now() - rec.t > WINDOW_MS) { rec.n = 0; rec.t = Date.now(); }
        if (rec.n >= MAX_FAILS) return json({ ok: false, locked: true });
        if (body.ok) { if (rec.n) await st.delete(k); return json({ ok: true }); }
        rec.n++; await st.put(k, rec); return json({ ok: false, left: MAX_FAILS - rec.n });
      }
      case '/quota': { // simple daily limits for the ✨ helper
        const day = new Date().toISOString().slice(0, 10);
        const ipKey = 'q:' + day + ':' + (body.ip || 'x'), allKey = 'q:' + day + ':all';
        const [a, b] = [(await st.get(ipKey)) || 0, (await st.get(allKey)) || 0];
        if (a >= body.perIp || b >= body.perDay) return json({ ok: false });
        await st.put({ [ipKey]: a + 1, [allKey]: b + 1 });
        return json({ ok: true });
      }
      case '/all': {
        const m = await st.list({ prefix: 'd:' });
        const items = {}; for (const [k, v] of m) items[k.slice(2)] = v;
        return json({ items });
      }
      case '/put': { await st.put('d:' + body.key, body.value); return json({ ok: true }); }
      case '/del': { await st.delete('d:' + body.key); return json({ ok: true }); }
      case '/bulk': {
        const entries = Object.entries(body.items || {}).filter(([k]) => KEY_RE.test(k));
        for (let i = 0; i < entries.length; i += 100) {
          const chunk = {}; entries.slice(i, i + 100).forEach(([k, v]) => { chunk['d:' + k] = v; });
          await st.put(chunk);
        }
        return json({ ok: true, count: entries.length });
      }
    }
    return json({ error: 'not found' }, 404);
  }
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function auth(request, env, db) {
  if (!env.PASSCODE) return json({ error: 'not_set' }, 503);
  const ip = request.headers.get('CF-Connecting-IP') || 'x';
  const code = request.headers.get('X-Code') || '';
  const ok = safeEqual(code, env.PASSCODE);
  const r = await (await db('/check', { ip, ok })).json();
  if (r.locked) return json({ error: 'too_many' }, 429);
  if (!ok) return json({ error: 'wrong_code', left: r.left }, 401);
  return null;
}

async function ai(request, env) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'The ✨ helper isn’t switched on yet: add ANTHROPIC_API_KEY in Cloudflare (see SETUP.md).' }, 503);
  let body; try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) return json({ error: 'Bad request' }, 400);
  const model = body.tier === 'quick' ? (env.MODEL_QUICK || 'claude-haiku-5-5') : (env.MODEL || 'claude-sonnet-5-5');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, stream: true, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) {
    console.log('Anthropic error', r.status, (await r.text()).slice(0, 500));
    return json({ error: r.status === 429 ? 'The AI helper is busy — try again in a minute.' : r.status === 401 ? 'Your Anthropic key isn’t working — check ANTHROPIC_API_KEY in Cloudflare.' : 'The AI helper had a problem. Please try again.' }, 502);
  }
  return new Response(r.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (pathname === '/api/ai' && request.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return ai(request, env);
      const stub = env.STORE.get(env.STORE.idFromName('me'));
      const ip = request.headers.get('CF-Connecting-IP') || 'x';
      const q = await (await stub.fetch('https://store/quota', { method: 'POST', body: JSON.stringify({
        ip, perIp: parseInt(env.DAILY_LIMIT || '80', 10), perDay: parseInt(env.DAILY_TOTAL || '300', 10) }) })).json();
      if (!q.ok) return json({ error: 'You\u2019ve reached today\u2019s limit for ✨ requests. Try again tomorrow!' }, 429);
      return ai(request, env);
    }
    return json({ error: 'Not found' }, 404);
  }
};
