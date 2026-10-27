import { state } from './store.js';
import { parseRef } from './books.js';

// Scripture text. BSB ships with the app. ESV is fetched from Crossway when
// the user has added a key; only the passage reference is sent.

const bsbBooks = new Map();
async function bsbBook(code) {
  if (!bsbBooks.has(code)) {
    const p = fetch(`data/bsb/${code}.json`).then(r => {
      if (!r.ok) throw new Error(`Could not load ${code}`);
      return r.json();
    });
    bsbBooks.set(code, p);
    p.catch(() => bsbBooks.delete(code));
  }
  return bsbBooks.get(code);
}

const ESV_CACHE = 'esv-v1';
// Crossway's terms limit how much ESV text an app may store, so keep only a
// handful of recent chapters on the phone.
const ESV_MAX_CHAPTERS = 12;

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

async function esvChapter(code, chapter) {
  const url = esvUrl(code, chapter);
  const cache = 'caches' in self ? await caches.open(ESV_CACHE) : null;
  const hit = cache && (await cache.match(url));
  if (hit) return parseEsv((await hit.json()).passages[0]);
  const res = await fetch(url, { headers: { Authorization: `Token ${state.settings.esvKey.trim()}` } });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'ESV key was not accepted' : `ESV error ${res.status}`);
  const body = await res.json();
  if (!body.passages?.length) throw new Error('ESV returned no text');
  if (cache) {
    await cache.put(url, new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - ESV_MAX_CHAPTERS))) await cache.delete(k);
  }
  return parseEsv(body.passages[0]);
}

export function wantsEsv() {
  return state.settings.translation === 'ESV' && state.settings.esvKey.trim() !== '';
}

// Returns { verses: string[], translation, note? }.
export async function getChapter(code, chapter) {
  if (wantsEsv()) {
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
export async function getPassage(ref) {
  const r = typeof ref === 'string' ? parseRef(ref) : ref;
  const out = [];
  for (let c = r.chapter; c <= r.endChapter; c++) {
    const { verses, translation } = await getChapter(r.book, c);
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
