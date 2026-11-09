# Loaded Bible

No accounts: everyone logs in with a **Bible code**. They can get one (like `GRACE-7K4M-2QXT`) or choose their own (10+ letters and numbers, like `SHENG446644`). Progress is saved online under that code, so it works on any device. Wrong guesses are blocked after 10 tries.

## Files
| File | What it is |
|---|---|
| `public/` | The website |
| `worker.js` | The server: Bible codes, saving progress, and the ✨ AI helper |
| `wrangler.jsonc` | Tells Cloudflare how to run it. Storage and the free AI are connected automatically |

## ✨ AI
By default the ✨ features use **Cloudflare Workers AI**, which is free with a daily allowance (resets at 00:00 UTC). There's nothing to set up.

Optional:
- Add the secret `ANTHROPIC_API_KEY` to use Claude instead (paid).
- `MODEL_FREE` picks a different free model. The default is `@cf/meta/llama-3.3-70b-instruct-fp8-fast`; `@cf/meta/llama-3.1-8b-instruct-fast` allows more uses per day but gives simpler answers.
- `DAILY_LIMIT` sets the number of ✨ requests per code per day (default 80).

**Never put keys in the GitHub files. This project is public.**
