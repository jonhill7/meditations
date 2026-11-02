# Shared translation server

A tiny Cloudflare Worker (`worker.js`) that keeps your API.Bible key secret
and lets everyone using Meditations read the translations you choose (like
the NIV) without a key of their own.

It only answers requests from the app's own address, only for the
translations listed in `TRANSLATIONS`, and stores nothing. The app adds the
copyright notice, keeps at most 12 recent chapters on each phone, and reports
displays to API.Bible's Fair Use Management System, as API.Bible's terms ask.

## Set it up (about 5 minutes, free)

1. Sign up or log in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Create Worker** (start from "Hello World").
   Name it `meditations-bible` and click **Deploy**.
3. Click **Edit code**, replace everything with the contents of
   [`worker.js`](worker.js), and click **Deploy**.
4. In the Worker, go to **Settings → Variables and Secrets** and add:
   - `API_BIBLE_KEY`, type **Secret**: your API.Bible key
   - `TRANSLATIONS`, type Text: `NIV` (comma separated for more)
   - `ALLOWED_ORIGINS`, type Text: `https://jonhill7.github.io`
5. Copy the Worker's address, e.g. `https://meditations-bible.<you>.workers.dev`,
   and put it in `js/config.js` as `SHARED_BIBLE_SERVER`.

Check it from a browser console on the app's page:
`fetch('https://meditations-bible.<you>.workers.dev/v1/bibles').then(r => r.json())`
should list the NIV. If the list is empty, the NIV isn't enabled for the key.

## Limits

- Cloudflare's free plan allows 100,000 requests a day.
- API.Bible plans have their own daily request limits; check yours in the
  API.Bible dashboard. Each chapter a phone hasn't stored yet is one request.
- To guard against abuse, you can add a rate limiting rule in Cloudflare
  (Security → WAF → Rate limiting rules) for the Worker's address.
