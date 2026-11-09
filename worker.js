// Loaded Bible — website server.
// No accounts: every person gets a personal "Bible code" (like GRACE-7K4M-2QXT).
// Their progress is stored online under that code, so they can open it on any device.
// ✨ features use Cloudflare's free Workers AI by default (no key needed, free daily allowance).
// Optional: add the secret ANTHROPIC_API_KEY to use Claude instead (paid).
// Optional vars: MODEL_FREE, MODEL, MODEL_QUICK, DAILY_LIMIT (✨ per code per day, default 80), DAILY_TOTAL (whole site, default 500)
import { DurableObject } from 'cloudflare:workers';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const KEY_RE = /^[A-Za-z0-9_.:@+~-]{1,120}$/;
const CODE_RE = /^[A-Z]{3,8}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const CUSTOM_RE = /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{10,24}$/; // your own code: 10+ letters and numbers
const validCode = c => CODE_RE.test(c) || CUSTOM_RE.test(c);
const WORDS = ['GRACE','PSALM','FAITH','HOPE','LIGHT','DOVE','LAMB','LION','CROSS','MERCY','PEACE','JOY','TRUTH','WORD','VINE','BREAD','RIVER','STONE','CROWN','SHIELD','SWORD','ROCK','SEED','HARVEST','OLIVE','CEDAR','STAR','DAWN','GLORY','HOLY','PRAISE','AMEN','EDEN','ZION','JORDAN','BETHEL','MANNA','ARK','TORCH','LAMP','SALT','FIG','PALM','HYMN','SHEPHERD','KING','ALPHA','OMEGA','JUBILEE','REFUGE','WISDOM','SPIRIT','GOSPEL','PILGRIM','EAGLE','FOUNT','ANCHOR','TRUMPET','HARP','PEARL','LILY','MORNING','SABBATH','PROMISE'];
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_FAILS = 10, WINDOW_MS = 15 * 60 * 1000;

function makeCode() {
  const r = new Uint32Array(9); crypto.getRandomValues(r);
  const part = (o) => Array.from({ length: 4 }, (_, i) => CHARS[r[o + i] % CHARS.length]).join('');
  return `${WORDS[r[0] % WORDS.length]}-${part(1)}-${part(5)}`;
}
const normCode = c => { const raw = String(c || '').toUpperCase().trim(); if (CODE_RE.test(raw)) return raw; const a = raw.replace(/[^A-Z0-9]/g, ''); if (CUSTOM_RE.test(a)) return a; const m = a.match(/^([A-Z]{3,8})([A-Z2-9]{4})([A-Z2-9]{4})$/); return m ? `${m[1]}-${m[2]}-${m[3]}` : a; };

// One class, two jobs: one instance per Bible code (holds that person's progress),
// plus one shared "limits" instance (wrong-code protection and daily ✨ limits).
export class Store extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const st = this.ctx.storage;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const p = url.pathname;
    // ----- limits instance -----
    if (p === '/rl-check') {
      const rec = await st.get('rl:' + body.ip);
      return json({ blocked: !!rec && Date.now() - rec.t < WINDOW_MS && rec.n >= MAX_FAILS });
    }
    if (p === '/rl-fail') {
      const k = 'rl:' + body.ip; let rec = (await st.get(k)) || { n: 0, t: Date.now() };
      if (Date.now() - rec.t > WINDOW_MS) rec = { n: 0, t: Date.now() };
      rec.n++; await st.put(k, rec); return json({ ok: true });
    }
    if (p === '/count') { // generic daily counter: {name, max}
      const k = 'c:' + new Date().toISOString().slice(0, 10) + ':' + body.name;
      const n = (await st.get(k)) || 0;
      if (n >= body.max) return json({ ok: false });
      await st.put(k, n + 1); return json({ ok: true });
    }
    // ----- code instance -----
    if (p === '/init') {
      if (await st.get('meta')) return json({ ok: false, exists: true });
      await st.put('meta', { created: Date.now() }); return json({ ok: true });
    }
    const meta = await st.get('meta');
    if (!meta) return json({ error: 'no_code' }, 401);
    if (p === '/exists') return json({ ok: true });
    if (p === '/all') {
      const m = await st.list({ prefix: 'd:' });
      const items = {}; for (const [k, v] of m) items[k.slice(2)] = v;
      return json({ items });
    }
    if (p === '/put') { await st.put('d:' + body.key, body.value); return json({ ok: true }); }
    if (p === '/del') { await st.delete('d:' + body.key); return json({ ok: true }); }
    if (p === '/bulk') {
      const entries = Object.entries(body.items || {}).filter(([k]) => KEY_RE.test(k));
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = {}; entries.slice(i, i + 100).forEach(([k, v]) => { chunk['d:' + k] = v; });
        await st.put(chunk);
      }
      return json({ ok: true, count: entries.length });
    }
    return json({ error: 'not found' }, 404);
  }
}

async function ai(request, env) {
  let body; try { body = await request.json(); } catch (e) { return json({ error: 'Bad request' }, 400); }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000) return json({ error: 'Bad request' }, 400);
  return env.ANTHROPIC_API_KEY ? claudeAI(body, env) : freeAI(body, env);
}

// Free: Cloudflare Workers AI (daily free allowance, resets 00:00 UTC). Output is converted to the same stream format the app reads.
async function freeAI(body, env) {
  if (!env.AI) return json({ error: 'The free AI isn’t connected yet. Please try again in a few minutes.' }, 503);
  const model = env.MODEL_FREE || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  let stream;
  try {
    stream = await env.AI.run(model, {
      messages: [
        { role: 'system', content: 'You are a careful, accurate Bible study assistant. Quote and reference Scripture correctly. Follow the requested output format exactly; when JSON is requested, reply with only valid JSON.' },
        { role: 'user', content: body.prompt }
      ],
      stream: true, max_tokens: body.tier === 'quick' ? 1200 : 4096
    });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.log('Workers AI error', m);
    if (/3036|allocation|neuron|limit/i.test(m)) return json({ error: 'Today’s free AI is used up. It resets every night at 1:00 (Amsterdam time) — please try again then!' }, 429);
    return json({ error: 'The free AI had a problem. Please try again.' }, 502);
  }
  const enc = new TextEncoder(), dec = new TextDecoder(); let buf = '';
  const out = (text) => enc.encode('data: ' + JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } }) + '\n\n');
  const ts = new TransformStream({
    transform(chunk, ctrl) {
      buf += dec.decode(chunk, { stream: true }); let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim(); if (!d || d === '[DONE]') continue;
        let j; try { j = JSON.parse(d); } catch (e) { continue; }
        const c = j.choices && j.choices[0];
        const t = j.response ?? (c && ((c.delta && c.delta.content) || c.text)) ?? '';
        if (t) ctrl.enqueue(out(t));
      }
    },
    flush(ctrl) { ctrl.enqueue(enc.encode('data: ' + JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }) + '\n\n')); }
  });
  return new Response(stream.pipeThrough(ts), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

async function claudeAI(body, env) {
  const prompt = body.prompt;
  const model = body.tier === 'quick' ? (env.MODEL_QUICK || 'claude-haiku-5-5') : (env.MODEL || 'claude-sonnet-5-5');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 12000, stream: true, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) {
    console.log('Anthropic error', r.status, (await r.text()).slice(0, 500));
    return json({ error: r.status === 429 ? 'The AI helper is busy — try again in a minute.' : r.status === 401 ? 'The Anthropic key isn’t working — check ANTHROPIC_API_KEY in Cloudflare.' : 'The AI helper had a problem. Please try again.' }, 502);
  }
  return new Response(r.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    const limits = env.STORE.get(env.STORE.idFromName('limits'));
    const L = async (path, payload) => (await limits.fetch('https://do' + path, { method: 'POST', body: JSON.stringify(payload) })).json();

    // Make a brand-new Bible code
    if (pathname === '/api/code/new' && request.method === 'POST') {
      if (!(await L('/count', { name: 'new:' + ip, max: 30 })).ok) return json({ error: 'Too many new codes today — try again tomorrow.' }, 429);
      for (let i = 0; i < 5; i++) {
        const code = makeCode();
        const stub = env.STORE.get(env.STORE.idFromName('code:' + code));
        const r = await (await stub.fetch('https://do/init', { method: 'POST', body: '{}' })).json();
        if (r.ok) return json({ code });
      }
      return json({ error: 'Please try again.' }, 500);
    }

    // Claim your own code (10+ letters and numbers)
    if (pathname === '/api/code/claim' && request.method === 'POST') {
      if ((await L('/rl-check', { ip })).blocked) return json({ error: 'too_many' }, 429);
      const want = normCode(request.headers.get('X-Code'));
      if (!CUSTOM_RE.test(want)) return json({ error: 'weak' }, 400);
      if (!(await L('/count', { name: 'new:' + ip, max: 30 })).ok) return json({ error: 'Too many new codes today — try again tomorrow.' }, 429);
      const stub = env.STORE.get(env.STORE.idFromName('code:' + want));
      const r = await (await stub.fetch('https://do/init', { method: 'POST', body: '{}' })).json();
      if (!r.ok) { await L('/rl-fail', { ip }); return json({ error: 'taken' }, 409); }
      return json({ code: want });
    }

    // Everything else needs a valid Bible code
    if ((await L('/rl-check', { ip })).blocked) return json({ error: 'too_many' }, 429);
    const code = normCode(request.headers.get('X-Code'));
    const bad = async () => { await L('/rl-fail', { ip }); return json({ error: 'no_code' }, 401); };
    if (!validCode(code)) return bad();
    const stub = env.STORE.get(env.STORE.idFromName('code:' + code));
    const D = (path, payload) => stub.fetch('https://do' + path, { method: 'POST', body: JSON.stringify(payload || {}) });

    if (pathname === '/api/code/check' && request.method === 'POST') {
      const r = await D('/exists'); return r.status === 401 ? bad() : json({ ok: true, code });
    }
    if (pathname === '/api/ai' && request.method === 'POST') {
      const r = await D('/exists'); if (r.status === 401) return bad();
      if (!(await L('/count', { name: 'ai:' + code, max: parseInt(env.DAILY_LIMIT || '80', 10) })).ok ||
          !(await L('/count', { name: 'ai:all', max: parseInt(env.DAILY_TOTAL || '500', 10) })).ok)
        return json({ error: 'You’ve reached today’s limit for ✨ requests. Try again tomorrow!' }, 429);
      return ai(request, env);
    }
    let res;
    if (pathname === '/api/data' && request.method === 'GET') res = await D('/all');
    else if (pathname === '/api/import' && request.method === 'POST') res = await D('/bulk', { items: ((await request.json().catch(() => ({}))).items) || {} });
    else if (pathname.startsWith('/api/item/')) {
      const key = decodeURIComponent(pathname.slice('/api/item/'.length));
      if (!KEY_RE.test(key)) return json({ error: 'Bad key' }, 400);
      if (request.method === 'PUT') {
        const value = await request.json().catch(() => undefined);
        if (value === undefined) return json({ error: 'Bad body' }, 400);
        res = await D('/put', { key, value });
      } else if (request.method === 'DELETE') res = await D('/del', { key });
    }
    if (!res) return json({ error: 'Not found' }, 404);
    if (res.status === 401) return bad();
    return res;
  }
};
