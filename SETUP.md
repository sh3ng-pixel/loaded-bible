# Loaded Bible: personal edition

## What's in this folder
| File | What it is |
|---|---|
| `public/` | The website (the app, icons, phone-install files) |
| `worker.js` | The small server that runs the ✨ AI helper, with daily limits |
| `wrangler.jsonc` | Tells Cloudflare how to run it |

Your progress is saved **on each device** (in the browser). To move it between devices or the Claude app, use **My account → Copy my progress / Import progress**.

## Turn on the ✨ features
In Cloudflare, open the **loadmybible** project → **Settings** → **Variables and Secrets** → **+ Add**:
- **Type:** Secret, **Name:** `ANTHROPIC_API_KEY`, **Value:** your key from console.anthropic.com. Set a monthly spend limit there.

Optional: `DAILY_LIMIT` (✨ requests per person per day, default 80) and `DAILY_TOTAL` (for the whole site, default 300).

**Never put keys in the files on GitHub. This project is public.**
