import { state } from './store.js';
import { parseRef } from './books.js';

// Scripture text. BSB and KJV ship with the app. ESV is fetched from
// Crossway, and other licensed translations (like the NIV) from API.Bible,
// when the user has added their own key in Settings. Keys stay on the phone
// and only the passage reference is sent.

export const TRANSLATIONS = {
  BSB: 'Berean Standard Bible',
  KJV: 'King James Version',
  ESV: 'English Standard Version',
};

const offlineBooks = new Map();
async function offlineBook(translation, code) {
  const key = `${translation}/${code}`;
  if (!offlineBooks.has(key)) {
    const p = fetch(`data/${translation.toLowerCase()}/${code}.json`).then(r => {
      if (!r.ok) throw new Error(`Could not load ${code}`);
      return r.json();
    });
    offlineBooks.set(key, p);
    p.catch(() => offlineBooks.delete(key));
  }
  return offlineBooks.get(key);
}
const bsbBook = code => offlineBook('BSB', code);

const ESV_CACHE = 'esv-v1';

function esvUrl(code, chapter) {
  const q = new URLSearchParams({
    q: `${code} ${chapter}`,
    'include-passage-references': 'false',
    'include-verse-numbers': 'true',
    'include-first-verse-numbers': 'true',
    'include-footnotes': 'false',
    'include-footnote-body': 'false',
    'include-headings': 'false',
    'include-short-copyright': 'false',
    'include-selahs': 'true',
    'indent-paragraphs': '0',
    'indent-poetry': 'false',
    'indent-declares': '0',
    'indent-psalm-doxology': '0',
    'line-length': '0',
  });
  return `https://api.esv.org/v3/passage/text/?${q}`;
}

// "[1] In the beginning ... [2] The earth ..." -> ['In the beginning ...', ...]
export function parseEsv(text) {
  const verses = [];
  const parts = text.split(/\[(\d+)\]/);
  for (let i = 1; i < parts.length; i += 2) {
    verses[+parts[i] - 1] = parts[i + 1].replace(/\s+/g, ' ').replace(/\s*\(ESV\)\s*$/, '').trim();
  }
  return Array.from(verses, v => v ?? '');
}

// Licensed texts may only be kept on the phone in small amounts, so each
// source keeps just its most recent chapters.
const MAX_STORED_CHAPTERS = 12;

async function cachedJson(cacheName, url, init) {
  const cache = 'caches' in self ? await caches.open(cacheName) : null;
  const hit = cache && (await cache.match(url));
  if (hit) return hit.json();
  const res = await fetch(url, init);
  if (!res.ok) {
    const e = new Error(res.status === 401 || res.status === 403 ? 'key was not accepted' : `error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const body = await res.json();
  if (cache) {
    await cache.put(url, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STORED_CHAPTERS))) await cache.delete(k);
  }
  return body;
}

// API.Bible (rest.api.bible). Book ids are the same USFM codes we use.
const API_BIBLE = 'https://rest.api.bible/v1';
const API_BIBLE_CACHE = 'apibible-v1';

function apiBibleHeaders() {
  return { 'api-key': state.settings.apiBibleKey.trim() };
}

export function hasApiBibleKey() {
  return (state.settings.apiBibleKey ?? '').trim() !== '';
}

// English Bibles the key can read: [{ id, abbr, name }].
export async function listApiBibles() {
  const res = await fetch(`${API_BIBLE}/bibles?language=eng`, { headers: apiBibleHeaders() });
  if (res.status === 401 || res.status === 403) throw new Error('API.Bible did not accept this key.');
  if (!res.ok) throw new Error(`API.Bible error ${res.status}.`);
  const { data } = await res.json();
  return data
    .map(b => ({ id: b.id, abbr: (b.abbreviationLocal || b.abbreviation || '').toUpperCase(), name: b.nameLocal || b.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// API.Bible's terms ask apps to report each display of licensed text through
// its Fair Use Management System. This sends only an anonymous token.
function reportFums(meta) {
  const src = /src="([^"]+)"/.exec(meta?.fumsNoScript ?? '')?.[1];
  if (src) new Image().src = src.replace(/&amp;/g, '&');
}

async function apiBibleChapter(bible, code, chapter) {
  const q = new URLSearchParams({
    'content-type': 'text',
    'include-notes': 'false',
    'include-titles': 'false',
    'include-chapter-numbers': 'false',
    'include-verse-numbers': 'true',
    'include-verse-spans': 'false',
  });
  const body = await cachedJson(API_BIBLE_CACHE, `${API_BIBLE}/bibles/${bible.id}/chapters/${code}.${chapter}?${q}`, { headers: apiBibleHeaders() });
  reportFums(body.meta);
  return { verses: parseEsv(body.data.content), copyright: body.data.copyright };
}

function apiBibleFor(translation) {
  return hasApiBibleKey() ? (state.settings.apiBibles ?? []).find(b => b.abbr === translation) : null;
}

async function esvChapter(code, chapter) {
  let body;
  try {
    body = await cachedJson(ESV_CACHE, esvUrl(code, chapter), { headers: { Authorization: `Token ${state.settings.esvKey.trim()}` } });
  } catch (e) {
    throw new Error(e.status ? `ESV ${e.message}` : e.message);
  }
  if (!body.passages?.length) throw new Error('ESV returned no text');
  return parseEsv(body.passages[0]);
}

export function hasEsvKey() {
  return state.settings.esvKey.trim() !== '';
}

// Translations that can be picked right now.
export function availableTranslations() {
  const builtIn = Object.keys(TRANSLATIONS).filter(t => t !== 'ESV' || hasEsvKey());
  const api = hasApiBibleKey() ? (state.settings.apiBibles ?? []).map(b => b.abbr) : [];
  return [...builtIn, ...api.filter(a => !builtIn.includes(a))];
}

export function translationName(t) {
  return TRANSLATIONS[t] ?? (state.settings.apiBibles ?? []).find(b => b.abbr === t)?.name ?? t;
}

// Returns { verses: string[], translation, note?, copyright? }.
export async function getChapter(code, chapter, translation = state.settings.translation) {
  if (translation === 'KJV') return { verses: (await offlineBook('KJV', code))[chapter - 1], translation: 'KJV' };
  const apiBible = apiBibleFor(translation);
  if (apiBible) {
    try {
      return { ...(await apiBibleChapter(apiBible, code, chapter)), translation };
    } catch (e) {
      const book = await bsbBook(code);
      const why = navigator.onLine ? (e.status ? `API.Bible ${e.message}` : e.message) : 'You are offline';
      return { verses: book[chapter - 1], translation: 'BSB', note: `${why}, so this is the BSB.` };
    }
  }
  if (translation === 'ESV' && hasEsvKey()) {
    try {
      return { verses: await esvChapter(code, chapter), translation: 'ESV' };
    } catch (e) {
      const book = await bsbBook(code);
      const why = navigator.onLine ? e.message : 'You are offline';
      return { verses: book[chapter - 1], translation: 'BSB', note: `${why}, so this is the BSB.` };
    }
  }
  return { verses: (await bsbBook(code))[chapter - 1], translation: 'BSB' };
}

// Text for a reference like 'JHN 3:16-18' as [{ verse, text }].
export async function getPassage(ref, translationWanted) {
  const r = typeof ref === 'string' ? parseRef(ref) : ref;
  const out = [];
  for (let c = r.chapter; c <= r.endChapter; c++) {
    const { verses, translation } = await getChapter(r.book, c, translationWanted);
    const from = c === r.chapter ? (r.verse ?? 1) : 1;
    const to = c === r.endChapter ? (r.endVerse ?? verses.length) : verses.length;
    for (let v = from; v <= Math.min(to, verses.length); v++) {
      if (verses[v - 1]) out.push({ chapter: c, verse: v, text: verses[v - 1], translation });
    }
  }
  return out;
}

const xrefBooks = new Map();
export async function crossRefs(code, chapter, verse) {
  if (!xrefBooks.has(code)) {
    const p = fetch(`data/xref/${code}.json`).then(r => (r.ok ? r.json() : {}));
    xrefBooks.set(code, p);
    p.catch(() => xrefBooks.delete(code));
  }
  return (await xrefBooks.get(code))[`${chapter}:${verse}`] ?? [];
}

// Public domain commentaries from the Free Use Bible API (bible.helloao.org).
// Only the book and chapter are sent; responses are kept on the phone.
export const COMMENTARIES = {
  'matthew-henry': 'Matthew Henry',
  'jamieson-fausset-brown': 'Jamieson, Fausset & Brown',
  'adam-clarke': 'Adam Clarke',
  'john-gill': 'John Gill',
  'keil-delitzsch': 'Keil & Delitzsch (Old Testament)',
  'tyndale': 'Tyndale Open Study Notes',
};
const COMMENTARY_CACHE = 'commentary-v1';

function flatten(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(flatten).join(' ');
  if (content && typeof content === 'object') return content.text ?? content.heading ?? '';
  return '';
}

// Returns { introduction, verses: Map<verseNumber, string[]> } or throws.
export async function getCommentary(code, chapter, id = state.settings.commentary) {
  const url = `https://bible.helloao.org/api/c/${id}/${code}/${chapter}.json`;
  const cache = 'caches' in self ? await caches.open(COMMENTARY_CACHE) : null;
  let res = cache && (await cache.match(url));
  if (!res) {
    try {
      res = await fetch(url);
    } catch {
      throw new Error(navigator.onLine ? 'Could not reach the commentary service.' : 'Commentary needs a connection the first time you open a chapter.');
    }
    if (res.status === 404) throw new Error(`${COMMENTARIES[id] ?? id} has nothing on this chapter.`);
    if (!res.ok) throw new Error(`Commentary service error ${res.status}.`);
    if (cache) await cache.put(url, res.clone());
  }
  const body = await res.json();
  const verses = new Map();
  for (const item of body.chapter?.content ?? []) {
    if (item.type !== 'verse') continue;
    const text = (Array.isArray(item.content) ? item.content : [item.content]).map(flatten).filter(Boolean);
    verses.set(item.number, [...(verses.get(item.number) ?? []), ...text]);
  }
  return { introduction: body.chapter?.introduction ?? '', verses };
}

// Fetches commentary for upcoming chapters so it is there offline.
export async function prefetchCommentary(chapters) {
  let ok = 0;
  for (const [code, ch] of chapters) {
    try {
      await getCommentary(code, ch);
      ok++;
    } catch {}
  }
  return ok;
}
