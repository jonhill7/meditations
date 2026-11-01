// Scripture memory: cards and spaced review.
//
// A verse starts in learning, where it is practised with more and more of
// the words hidden. Once you can say it, it moves to review on a schedule
// in the SM-2 family (the method behind Anki and SuperMemo): after each
// recall you grade yourself, and the gap grows by the card's "ease", which
// itself drifts with how hard the verse has been. Misses come back the next
// day. Longer gaps get a little random spread so verses don't all fall due
// together.
import { addDays } from './reflections.js';
import { parseRef, formatRef } from './books.js';

export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_INTERVAL = 365;
export const LEARN_STAGES = 5;

export function cardId(refs) {
  return refs.join('|');
}

export function newCard(refs, date, extra = {}) {
  return {
    id: cardId(refs), refs, added: date, status: 'learning', stage: 0,
    ease: START_EASE, interval: 0, due: date, reps: 0, lapses: 0, last: null, ...extra,
  };
}

export function finishLearning(card, date) {
  Object.assign(card, { status: 'review', stage: LEARN_STAGES, interval: 1, due: addDays(date, 1), last: date });
}

function fuzz(days, rng) {
  if (days < 7) return days;
  const spread = Math.max(1, Math.round(days * 0.1));
  return days - spread + Math.floor(rng() * (2 * spread + 1));
}

// What each grade would do, without changing the card.
export function preview(card, grade, rng = () => 0.5) {
  let { ease, interval } = card;
  if (grade === 'again') return { ease: Math.max(MIN_EASE, ease - 0.2), interval: 1 };
  if (grade === 'hard') {
    ease = Math.max(MIN_EASE, ease - 0.15);
    interval = Math.max(1, Math.round(interval * 1.2));
  } else if (grade === 'good') {
    interval = card.reps === 0 ? 3 : Math.round(interval * ease);
  } else if (grade === 'easy') {
    ease += 0.15;
    interval = Math.max(4, Math.round(interval * ease * 1.3));
  }
  return { ease, interval: Math.min(MAX_INTERVAL, fuzz(Math.max(1, interval), rng)) };
}

export function grade(card, g, date, rng = Math.random) {
  const next = preview(card, g, rng);
  card.ease = next.ease;
  card.interval = next.interval;
  card.due = addDays(date, next.interval);
  card.reps += 1;
  if (g === 'again') card.lapses += 1;
  card.last = date;
}

export function isDue(card, date) {
  return card.status === 'review' && card.due <= date;
}

export function cardLabel(card) {
  if (card.refs.length === 1) return formatRef(card.refs[0]);
  // e.g. Psalm 119:9, 11
  const first = parseRef(card.refs[0]);
  const rest = card.refs.slice(1).map(r => parseRef(r)).map(r => (r.chapter === first.chapter ? `${r.verse}` : `${r.chapter}:${r.verse}`));
  return `${formatRef(card.refs[0])}, ${rest.join(', ')}`;
}

// Every 'BOOK c:v' a card covers, for highlighting in the reader.
export function verseKeys(card) {
  const out = [];
  for (const ref of card.refs) {
    const r = parseRef(ref);
    if (!r?.verse) continue;
    const end = r.endChapter === r.chapter ? r.endVerse : r.verse;
    for (let v = r.verse; v <= end; v++) out.push(`${r.book} ${r.chapter}:${v}`);
  }
  return out;
}

// Words of a verse with some hidden for a learning stage. Stage 0 shows
// everything; 1 and 2 hide about a third and two thirds; 3 shows first
// letters only; 4 hides everything. The same words stay hidden for a verse.
export function maskWords(text, stage, seed = 1) {
  const words = text.split(/\s+/).filter(Boolean);
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return words.map(w => {
    const r = rand();
    let hidden;
    if (stage <= 0) hidden = false;
    else if (stage === 1) hidden = r < 0.34;
    else if (stage === 2) hidden = r < 0.67;
    else hidden = true;
    const firstLetter = stage === 3;
    return { word: w, hidden, firstLetter };
  });
}

export function seedFor(id) {
  let h = 7;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 2147483647;
  return h || 1;
}
