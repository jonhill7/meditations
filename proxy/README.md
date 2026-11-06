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

## Home screen widget (optional)

The same Worker can hold each phone's widget feed: just today's pinned verses, plus reflections or prayer titles only if that phone turns them on. Each phone gets its own random link, and a feed is deleted after 3 days.

1. In Cloudflare, open **Storage & Databases → KV** and create a namespace named `meditations-widget`.
2. Open the Worker, then **Settings → Bindings → Add → KV namespace**. Set the variable name to `WIDGET` and pick `meditations-widget`.
3. Paste the latest `worker.js` into the Worker and deploy.

Then in the app, open **Settings → Home screen widget**, and follow **How to set up KWGT**. In short: install KWGT, add a widget with a Text module, and paste the formula the app gives you. It looks like:

```
$if(wg("https://YOUR-WORKER/widget/TOKEN", json, .date) = df(yyyy-MM-dd), wg("https://YOUR-WORKER/widget/TOKEN", json, .text), "Open Meditations to pin today's verses")$
```

The feed also has `title` (the date), `count` and `items` (each with `kind`, `title`, `text`) if you want a fancier layout.

## Limits

- Cloudflare's free plan allows 100,000 requests a day.
- API.Bible plans have their own daily request limits; check yours in the
  API.Bible dashboard. Each chapter a phone hasn't stored yet is one request.
- To guard against abuse, you can add a rate limiting rule in Cloudflare
  (Security → WAF → Rate limiting rules) for the Worker's address.
