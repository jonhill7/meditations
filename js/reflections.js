// Which reminders to reflect on each day.
//
// Reminders go stale when you see the same list every morning, so they
// rotate, loosely following spaced repetition:
// - A new reminder shows every day for its first 3 days, to settle it in.
// - After that, each time you tap it as reflected it goes away for a random
//   3 to 7 days. The randomness keeps the mix of reminders changing.
// - One you don't get to stays due and comes back the next day.
// - Pinned reminders show every day.
// - Every day has at least 3 (when you have 3), topped up with the ones
//   coming due soonest, and at most 6 so a morning never feels like a chore.
//   New reminders get the first places, then the longest overdue; the rest
//   wait for a later day.
// The day's set is picked once, in random order, and kept for that day.

export const INTRO_DAYS = 3;
export const MIN_GAP = 3;
export const MAX_GAP = 7;
export const MIN_PER_DAY = 3;
export const MAX_PER_DAY = 6;

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function randomGap(rng = Math.random) {
  return MIN_GAP + Math.floor(rng() * (MAX_GAP - MIN_GAP + 1));
}

// Reminders saved before rotation existed are simply due now.
export function normalize(r, date) {
  r.introLeft ??= 0;
  r.nextDue ??= date;
  r.pinned ??= false;
  return r;
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns the ids to show on `date`.
export function pickForDay(reminders, date, rng = Math.random) {
  const active = reminders.filter(r => !r.archived).map(r => normalize(r, date));
  const pinned = active.filter(r => r.pinned);
  const fresh = active
    .filter(r => !r.pinned && r.introLeft > 0)
    .sort((a, b) => (a.created ?? '').localeCompare(b.created ?? ''));
  const due = active
    .filter(r => !r.pinned && r.introLeft === 0 && r.nextDue <= date)
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue));

  const chosen = [...pinned];
  for (const r of [...fresh, ...due]) if (chosen.length < MAX_PER_DAY) chosen.push(r);

  if (chosen.length < MIN_PER_DAY) {
    // Top up with the reminders coming due soonest; break ties at random.
    const rest = shuffle(active.filter(r => !chosen.includes(r)), rng)
      .sort((a, b) => a.nextDue.localeCompare(b.nextDue));
    chosen.push(...rest.slice(0, MIN_PER_DAY - chosen.length));
  }
  return shuffle(chosen, rng).map(r => r.id);
}

// Records a reflection and schedules the next showing. Returns what it
// changed so the tap can be undone.
export function markDone(r, date, rng = Math.random) {
  const prev = { introLeft: r.introLeft, nextDue: r.nextDue, lastDone: r.lastDone ?? null };
  r.lastDone = date;
  if (r.pinned) return prev;
  if (r.introLeft > 0) {
    r.introLeft -= 1;
    r.nextDue = r.introLeft > 0 ? addDays(date, 1) : addDays(date, randomGap(rng));
  } else {
    r.nextDue = addDays(date, randomGap(rng));
  }
  return prev;
}

export function undoDone(r, prev) {
  Object.assign(r, prev);
}

// Short description of when a reminder will next appear.
export function scheduleLabel(r, date) {
  if (r.archived) return '';
  if (r.pinned) return 'Every day';
  if (r.introLeft > 0) return `New: daily for ${r.introLeft} more day${r.introLeft === 1 ? '' : 's'}`;
  const [y1, m1, d1] = date.split('-').map(Number);
  const [y2, m2, d2] = r.nextDue.split('-').map(Number);
  const n = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  if (n <= 0) return 'Due now';
  if (n === 1) return 'Back tomorrow';
  return `Back in ${n} days`;
}
