# Loaded Bible

No accounts: everyone gets a personal **Bible code** (like `GRACE-7K4M-2QXT`) the first time they open the site. Their progress is saved online under that code, so they can open it on any device. Codes are hard to guess, and wrong guesses are blocked after 10 tries.

## Files
| File | What it is |
|---|---|
| `public/` | The website |
| `worker.js` | The server: Bible codes, saving progress, and the ✨ AI helper (with daily limits) |
| `wrangler.jsonc` | Tells Cloudflare how to run it. Storage is created automatically |

## Turn on the ✨ features
In Cloudflare, open **loadmybible** → **Settings** → **Variables and Secrets** → **+ Add** → Secret `ANTHROPIC_API_KEY` = your key from console.anthropic.com. Set a monthly spend limit there.

Optional: `DAILY_LIMIT` (✨ requests per code per day, default 80) and `DAILY_TOTAL` (the whole site, default 500).

**Never put keys in the GitHub files. This project is public.**
