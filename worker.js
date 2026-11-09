// Loaded Bible — Cloudflare Worker entry.
// Serves the website from /public and runs the small server parts (AI + TikTok login).
import { onRequestPost as aiPost } from './functions/api/ai.js';
import { onRequestGet as tiktokStart } from './functions/api/tiktok/start.js';
import { onRequestGet as tiktokCallback } from './functions/api/tiktok/callback.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/ai') {
      return request.method === 'POST' ? aiPost({ request, env, ctx }) : new Response('Method not allowed', { status: 405 });
    }
    if (pathname === '/api/tiktok/start') return tiktokStart({ request, env, ctx });
    if (pathname === '/api/tiktok/callback') return tiktokCallback({ request, env, ctx });
    return env.ASSETS.fetch(request);
  }
};
