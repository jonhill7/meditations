// Home-screen widget feed.
//
// The widget shows what you chose for the day: the verse of the day once
// you check it as read, verses from your reading, memory verses you worked
// on, the reflections you selected (unless turned off in Settings), and
// prayers you put on it. The app
// writes that day's picks to a private link on the shared server, and a
// widget app such as KWGT reads it. Nothing else is sent.
import { state, save, today, day } from './store.js';
import { parseRef, formatRef, refKey } from './books.js';
import { getPassage } from './bible.js';
import { verseForDate } from './votd.js';
import { SHARED_BIBLE_SERVER } from './config.js';

export function widgetSettings() {
  const ws = (state.settings.widget ??= { token: '', reflections: true, lastPublished: null, lastError: null });
  // Reflections became on by default after the first version; turn them on once.
  if (!ws.v2) Object.assign(ws, { reflections: true, v2: true });
  return ws;
}

export function widgetPicks(date = today()) {
  const w = (day(date).widget ??= { verses: [], memory: [] });
  w.prayers ??= [];
  return w;
}

// ['JHN 3:16', 'JHN 3:17', 'ROM 8:28'] -> ['JHN 3:16-17', 'ROM 8:28']
export function mergeVerseRefs(refs) {
  const sorted = [...new Set(refs)].map(parseRef).filter(r => r?.verse)
    .sort((a, b) => refKey(`${a.book} ${a.chapter}:${a.verse}`) - refKey(`${b.book} ${b.chapter}:${b.verse}`));
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.book === r.book && last.chapter === r.chapter && r.verse <= last.end + 1) last.end = Math.max(last.end, r.endVerse);
    else out.push({ book: r.book, chapter: r.chapter, start: r.verse, end: r.endVerse });
  }
  return out.map(r => `${r.book} ${r.chapter}:${r.start}${r.end > r.start ? `-${r.end}` : ''}`);
}

// One block of text for a simple widget: each item's title, then its text.
export function feedText(items) {
  return items.map(i => (i.kind === 'reflection' || i.kind === 'prayer' ? `• ${i.text}` : `${i.title}\n${i.text}`)).join('\n\n');
}

// The same text with KWGT's BBCode-style formatting: a small date line,
// bold references with the translation in grey, and grouped reflections
// and prayers under small headings.
const ACCENT = '#D9B48A';
const GREY = '#A8A29A';
const plain = t => String(t).replace(/\[/g, '(').replace(/\]/g, ')');
export function feedRich(items, title) {
  const out = [`[s=0.75][c=${ACCENT}]${plain(title).toUpperCase()}[/c][/s]`];
  if (!items.length) out.push('[i]Nothing chosen yet today.[/i]');
  for (const i of items.filter(i => i.kind === 'verse' || i.kind === 'memory')) {
    const tag = [i.kind === 'memory' ? 'memory' : '', i.tr].filter(Boolean).join(' · ');
    out.push(`[b]${plain(i.title)}[/b]${tag ? `  [s=0.7][c=${GREY}]${plain(tag)}[/c][/s]` : ''}\n${plain(i.text)}`);
  }
  for (const [kind, label] of [['reflection', 'Reflect'], ['prayer', 'Pray']]) {
    const list = items.filter(i => i.kind === kind);
    if (list.length) out.push(`[s=0.75][c=${ACCENT}]${label.toUpperCase()}[/c][/s]\n${list.map(i => `• ${plain(i.text)}`).join('\n')}`);
  }
  return out.join('\n\n');
}

export function toggle(list, value) {
  const i = list.indexOf(value);
  if (i >= 0) list.splice(i, 1);
  else list.push(value);
  return i < 0;
}

export function isPinnedVerse(ref) {
  return widgetPicks().verses.includes(ref);
}

// The verse of the day is on the widget when it's checked as read, unless taken off.
export function votdOnWidget(date = today()) {
  const d = day(date);
  return !!d.verse && !widgetPicks(date).votdHidden;
}

// Memory verses learned, practiced or reviewed today go on the widget.
export function addMemoryToday(id) {
  const p = widgetPicks();
  if (p.memory.includes(id) || (p.memoryHidden ?? []).includes(id)) return;
  p.memory.push(id);
  schedulePublish();
}

export function pinCount() {
  const p = widgetPicks();
  return (votdOnWidget() ? 1 : 0) + mergeVerseRefs(p.verses).length + p.memory.length;
}

async function passageText(refs, translation) {
  const parts = [];
  let tr = translation;
  for (const ref of refs) {
    const vs = await getPassage(ref, translation);
    tr = vs[0]?.translation ?? tr;
    parts.push(vs.map(v => v.text).join(' '));
  }
  return { text: parts.join(' … '), tr };
}

export async function buildFeed(date = today()) {
  const picks = widgetPicks(date);
  const ws = widgetSettings();
  const d = state.days[date] ?? {};
  const items = [];
  if (votdOnWidget(date)) {
    const ref = verseForDate(date);
    const { text, tr } = await passageText([ref]);
    items.push({ kind: 'verse', title: formatRef(ref), text, tr });
  }
  for (const ref of mergeVerseRefs(picks.verses)) {
    const { text, tr } = await passageText([ref]);
    items.push({ kind: 'verse', title: formatRef(ref), text, tr });
  }
  const { cardLabel } = await import('./memory.js');
  const { memoryTranslation } = await import('./views/memory.js');
  for (const id of picks.memory) {
    const card = state.memory.cards[id];
    if (!card) continue;
    const { text, tr } = await passageText(card.refs, memoryTranslation());
    items.push({ kind: 'memory', title: cardLabel(card), text, tr });
  }
  if (ws.reflections) {
    for (const id of Object.keys(d.doneReflections ?? {})) {
      const r = state.reminders.find(x => x.id === id && !x.archived);
      if (r) items.push({ kind: 'reflection', title: 'Reflection', text: r.text });
    }
  }
  for (const id of picks.prayers) {
    const p = state.prayers.find(x => x.id === id);
    if (p) items.push({ kind: 'prayer', title: 'Prayer', text: p.title });
  }
  const [y, m, dd] = date.split('-').map(Number);
  const title = new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return {
    date,
    title,
    count: items.length,
    text: items.length ? feedText(items) : 'Nothing chosen yet today.',
    rich: feedRich(items, title),
    items,
    updated: new Date().toISOString(),
  };
}

export function widgetUrl() {
  const ws = widgetSettings();
  if (!SHARED_BIBLE_SERVER) return '';
  if (!ws.token) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    ws.token = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    save();
  }
  return `${SHARED_BIBLE_SERVER}/widget/${ws.token}`;
}

export async function publishWidget() {
  const url = widgetUrl();
  const ws = widgetSettings();
  if (!url) return { ok: false, reason: 'not-configured' };
  try {
    const feed = await buildFeed();
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(feed) });
    if (!res.ok) throw new Error(`server said ${res.status}`);
    ws.lastPublished = new Date().toISOString();
    ws.lastError = null;
    save();
    return { ok: true };
  } catch (e) {
    ws.lastError = navigator.onLine ? e.message : 'offline';
    save();
    return { ok: false, reason: ws.lastError };
  }
}

let timer = null;
// Called after any change to the day's picks; sends the feed shortly after.
export function schedulePublish() {
  clearTimeout(timer);
  timer = setTimeout(publishWidget, 1500);
}

// KWGT text formula. Shows today's picks, or a prompt when the feed is from an earlier day.
export function kwgtFormula(url) {
  return `$if(wg("${url}", json, .date) = df(yyyy-MM-dd), wg("${url}", json, .rich), "[i]Open Meditations to choose today's verses.[/i]")$`;
}

// Publish when the app opens, so the widget moves to the new day.
export function publishIfStale() {
  const ws = widgetSettings();
  if (!SHARED_BIBLE_SERVER || !ws.token) return;
  // Every open, at most once a minute, so the feed always matches this version
  // of the app and today's choices.
  if (ws.lastPublished && Date.now() - new Date(ws.lastPublished) < 60_000) return;
  publishWidget();
}
