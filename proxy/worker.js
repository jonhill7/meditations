// Meditations translation proxy (Cloudflare Worker).
//
// Holds the API.Bible key as a secret so everyone using the app can read
// the licensed translations it unlocks without seeing the key. It answers
// only two kinds of request, for the translations you list, and only from
// the app's own web address:
//   GET /v1/bibles                                  the allowed translations
//   GET /v1/bibles/{bibleId}/chapters/{BOOK}.{n}    one chapter
// Nothing is stored for these; the app keeps a few recent chapters itself.
//
// It also holds each phone's home-screen widget feed, if a KV namespace is
// bound as WIDGET:
//   PUT /widget/{token}   the app saves today's pinned items (from the app only)
//   GET /widget/{token}   the widget app reads them (any client, needs the token)
// The token is a long random string only that phone knows. Feeds expire
// after three days.
//
// Settings (Worker → Settings → Variables and Secrets):
//   API_BIBLE_KEY    secret: your API.Bible key
//   TRANSLATIONS     abbreviations to share, comma separated, e.g. "NIV"
//   ALLOWED_ORIGINS  where the app runs, e.g. "https://jonhill7.github.io"

const UPSTREAM = 'https://rest.api.bible/v1';
const CHAPTER_PARAMS = ['content-type', 'include-notes', 'include-titles', 'include-chapter-numbers', 'include-verse-numbers', 'include-verse-spans'];

let biblesCache = { at: 0, list: null };

function list(value, fallback) {
  return (value || fallback).split(',').map(s => s.trim()).filter(Boolean);
}

async function allowedBibles(env) {
  if (biblesCache.list && Date.now() - biblesCache.at < 3600_000) return biblesCache.list;
  const res = await fetch(`${UPSTREAM}/bibles?language=eng`, { headers: { 'api-key': env.API_BIBLE_KEY } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const wanted = list(env.TRANSLATIONS, 'NIV').map(s => s.toUpperCase());
  const { data } = await res.json();
  const keep = data.filter(b => wanted.includes((b.abbreviationLocal || b.abbreviation || '').toUpperCase()));
  biblesCache = { at: Date.now(), list: keep };
  return keep;
}

function json(body, status, cors) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const WIDGET_MAX_BYTES = 16 * 1024;
const WIDGET_TTL_SECONDS = 3 * 86400;

async function handleWidget(request, env, token, fromApp, cors) {
  if (!env.WIDGET) return json({ error: 'widget storage not set up' }, 501, cors);
  const key = `widget:${token}`;
  if (request.method === 'GET') {
    const feed = await env.WIDGET.get(key);
    return json(feed ?? { date: null, count: 0, text: 'Open Meditations and pin something for today.', items: [] }, 200, cors);
  }
  if (request.method === 'PUT') {
    if (!fromApp) return json({ error: 'forbidden' }, 403, cors);
    const body = await request.text();
    if (body.length > WIDGET_MAX_BYTES) return json({ error: 'too large' }, 413, cors);
    try {
      JSON.parse(body);
    } catch {
      return json({ error: 'not json' }, 400, cors);
    }
    await env.WIDGET.put(key, body, { expirationTtl: WIDGET_TTL_SECONDS });
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'method not allowed' }, 405, cors);
}

export default {
  async fetch(request, env) {
    const origins = list(env.ALLOWED_ORIGINS, 'https://jonhill7.github.io');
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    cors['Access-Control-Allow-Methods'] = 'GET, PUT, OPTIONS';
    cors['Access-Control-Allow-Headers'] = 'Content-Type';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const widget = /^\/widget\/([0-9a-f]{32})$/.exec(new URL(request.url).pathname);
    if (widget) return handleWidget(request, env, widget[1], origins.includes(origin), cors);

    if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, cors);
    // Browsers always send Origin on these requests; anything else is not the app.
    if (!origins.includes(origin)) return json({ error: 'forbidden' }, 403, cors);
    if (!env.API_BIBLE_KEY) return json({ error: 'server has no API_BIBLE_KEY' }, 500, cors);

    const url = new URL(request.url);
    try {
      const bibles = await allowedBibles(env);
      if (url.pathname === '/v1/bibles') return json({ data: bibles }, 200, cors);

      const m = /^\/v1\/bibles\/([\w-]+)\/chapters\/([1-3A-Z]{3}\.\d{1,3})$/.exec(url.pathname);
      if (!m) return json({ error: 'not found' }, 404, cors);
      if (!bibles.some(b => b.id === m[1])) return json({ error: 'translation not shared' }, 403, cors);

      const q = new URLSearchParams();
      for (const k of CHAPTER_PARAMS) if (url.searchParams.has(k)) q.set(k, url.searchParams.get(k));
      const res = await fetch(`${UPSTREAM}/bibles/${m[1]}/chapters/${m[2]}?${q}`, { headers: { 'api-key': env.API_BIBLE_KEY } });
      return json(await res.text(), res.status, cors);
    } catch (e) {
      return json({ error: 'upstream unavailable' }, 502, cors);
    }
  },
};
