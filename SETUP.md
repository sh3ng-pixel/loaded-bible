# Loaded Bible: personal edition

This is your own private Loaded Bible: one website, unlocked with your code, and your progress is saved online so it's the same on every device.

## What's in this folder
| File | What it is |
|---|---|
| `public/` | The website (the app, icons, phone-install files) |
| `worker.js` | The small server: checks your code, saves your progress, runs the ✨ AI helper |
| `wrangler.jsonc` | Tells Cloudflare how to run it. Your progress storage is created automatically |

## Setup (in the Cloudflare dashboard)
Go to your **loadmybible** project → **Settings** → **Variables and Secrets** → **+ Add**:

1. **Type:** Secret, **Name:** `PASSCODE`, **Value:** your unlock code.
2. **Type:** Secret, **Name:** `ANTHROPIC_API_KEY`, **Value:** your key from console.anthropic.com. This is for the ✨ features: add a payment method there and set a monthly limit (e.g. $5–10).

Tap **Deploy** (or **Save**). Done.

**Never put your code or key in the files on GitHub.** This project is public, and secrets belong only in Cloudflare.

## Changing your code
Edit the `PASSCODE` secret in Cloudflare. Every device asks for the new code the next time it loads.

## Safety
After 8 wrong codes, the site locks itself for 15 minutes.
