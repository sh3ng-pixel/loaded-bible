# Loaded Bible: website setup guide

This folder is the full **Loaded Bible** website. It includes:

- accounts: email and password, "forgot password", Google, and TikTok (optional)
- "My account", donations and the ✨ AI helpers

Follow the steps in order. It takes about an hour the first time, and **every service below has a free plan**. The only things you pay for are the AI (a few cents per use) and the app stores, if you go there later.

| File | What it is |
|---|---|
| `index.html` | The app |
| `config.js` | **Your settings: you fill this in (step 1)** |
| `functions/api/ai.js` | Server code that talks to Claude (keeps your secret key safe) |
| `functions/api/tiktok/…` | Server code for "Continue with TikTok" |
| `firestore.rules` | Security rules: each person can only see their own notes |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make it installable on phones and work offline |
| `privacy.html`, `terms.html` | Required by Google Play, Apple and TikTok. **Fill in `[YOUR CONTACT EMAIL]` and `[DATE]`** |

---

## 1. Firebase: accounts and saving progress (free)

1. Go to **console.firebase.google.com**, click **Create a project** and name it `loaded-bible`. You can turn Analytics off.
2. Click the **</> (Web)** icon to add a web app and name it `Loaded Bible`. Firebase shows a block of code with `apiKey`, `authDomain`, and so on. **Copy those values into `config.js`.**
3. In the left menu, open **Build → Authentication → Get started → Sign-in method**:
   - Turn on **Email/Password**.
   - Turn on **Google**, then pick a support email.
4. Under **Authentication → Templates**, you can change the "Password reset" email, for example the sender name "Loaded Bible". Firebase sends the forgot-password emails for you.
5. Open **Build → Firestore Database → Create database**. Pick a location near your users (e.g. `eur3` for Europe) and **Production mode**.
6. In Firestore, open the **Rules** tab, replace everything with the contents of `firestore.rules`, and click **Publish**.

## 2. Anthropic: the ✨ AI helper

1. Go to **console.anthropic.com**, sign up, and add a payment method.
2. **Set a monthly spend limit** (e.g. $20) under *Limits*, so you can never get a surprise bill.
3. Create an **API key** and keep it secret. Never put it in `config.js` or anywhere in the website files.

## 3. Put the folder on GitHub (free)

1. Create an account at **github.com**, then create a **New repository** called `loaded-bible`. Private is fine.
2. Click **uploading an existing file** and drag in **everything inside this folder**, including the `functions` and `icons` folders. Then click **Commit**.

## 4. Publish with Cloudflare Pages (free)

1. Create an account at **dash.cloudflare.com** and open **Workers & Pages → Create → Pages → Connect to Git**.
2. Choose your `loaded-bible` repository.
3. Set **Framework preset: None**. Leave the build command **empty** and set the output directory to `/`.
4. Under **Environment variables (advanced)**, add:
   - `ANTHROPIC_API_KEY`: your key from step 2. Click **Encrypt**.
   - `FIREBASE_API_KEY`: the `apiKey` value from `config.js`.
5. Click **Save and Deploy**. You get a web address like `https://loaded-bible.pages.dev`.
6. Back in **Firebase → Authentication → Settings → Authorized domains**, click **Add domain** and add `loaded-bible.pages.dev`. Add your own domain too if you buy one later.

**Done: your website is live.** Open it on your phone and use **Share → Add to Home Screen** (iPhone) or **⋮ → Install app** (Android).

Optional: to stop anyone from using too much AI, go to **Workers & Pages → KV**, create a namespace, then in your Pages project go to **Settings → Functions → KV bindings** and bind it as `LIMITS`. You can also add an environment variable `DAILY_LIMIT` (e.g. `60`) for the number of ✨ requests allowed per person per day.

## 5. Donations (PayPal)

The Donate button already sends money to **shengcremers@gmail.com**. Make sure that email is **added and confirmed** in your PayPal account (PayPal → Settings → Email). To use euros, set `currency: "EUR"` in `config.js`.

## 6. TikTok login (optional, needs TikTok's approval)

1. Go to **developers.tiktok.com**, log in, and choose **Manage apps → Connect an app**.
2. Fill in the app details. TikTok asks for a Terms and a Privacy Policy link: use `https://YOURSITE/terms.html` and `https://YOURSITE/privacy.html`.
3. Add the **Login Kit** product with **Web** as the platform. Set the **Redirect URI** to `https://YOURSITE/api/tiktok/callback` and the scope to `user.info.basic`.
4. **Submit for review.** This can take a few days.
5. In Firebase, go to **Project settings → Service accounts → Generate new private key**. A file downloads.
6. In Cloudflare Pages, under **Settings → Environment variables**, add (all encrypted):
   - `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`: from your TikTok app page.
   - `FIREBASE_SERVICE_ACCOUNT`: open the downloaded file and paste **its whole contents**.
7. In `config.js`, set `tiktok: true`, then upload the changed file to GitHub. Cloudflare updates the site by itself.

**About Instagram:** since December 2024, Instagram no longer lets apps log in personal accounts. Only business and creator accounts can, and that needs Meta's app review. That's why there's no Instagram button. If you want, Facebook or Apple login can be added instead.

## 7. Updating the app later

Change files on GitHub (or upload new versions) and Cloudflare publishes the update automatically within a minute. Phones that installed it get the update too.

## 8. Google Play and the App Store

Once the site is live, go to **pwabuilder.com**, paste your web address, and download the **Android** package for Google Play. The PWABuilder docs explain each step. Apple is harder; see the notes in the chat.
