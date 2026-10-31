import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickForDay, markDone, undoDone, addDays, randomGap, MAX_PER_DAY } from '../js/reflections.js';

const D = '2026-11-01';
let n = 0;
const make = (extra = {}) => ({ id: `r${n++}`, text: 'x', archived: false, introLeft: 0, nextDue: '2026-12-31', pinned: false, ...extra });
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('addDays crosses months', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
});

test('gaps are 3 to 7 days', () => {
  assert.equal(randomGap(() => 0), 3);
  assert.equal(randomGap(() => 0.9999), 7);
});

test('new reminders show for three days, then go away 3-7 days', () => {
  const r = make({ introLeft: 3, nextDue: D });
  let date = D;
  for (let i = 0; i < 3; i++) {
    assert.ok(pickForDay([r], date).includes(r.id), `intro day ${i + 1}`);
    markDone(r, date, () => 0.5);
    date = addDays(date, 1);
  }
  assert.equal(r.introLeft, 0);
  assert.equal(r.nextDue, addDays(D, 2 + 5));
});

test('at least three a day, topped up with the soonest due', () => {
  const soon = make({ nextDue: addDays(D, 1) });
  const later = make({ nextDue: addDays(D, 6) });
  const mid = make({ nextDue: addDays(D, 3) });
  const far = make({ nextDue: addDays(D, 9) });
  const picked = pickForDay([far, later, soon, mid], D);
  assert.equal(picked.length, 3);
  assert.ok(!picked.includes(far.id));
});

test('adding many at once still caps the day', () => {
  const fresh = Array.from({ length: 10 }, () => make({ introLeft: 3, nextDue: D }));
  assert.equal(pickForDay(fresh, D).length, MAX_PER_DAY);
});

test('caps the day, keeps oldest due first, puts new and pinned first', () => {
  const due = Array.from({ length: 10 }, (_, i) => make({ nextDue: addDays(D, -i) }));
  const fresh = make({ introLeft: 3, nextDue: D });
  const pin = make({ pinned: true });
  const picked = pickForDay([...due, fresh, pin], D);
  assert.equal(picked.length, MAX_PER_DAY);
  assert.ok(picked.includes(fresh.id) && picked.includes(pin.id));
  assert.ok(picked.includes(due[9].id), 'oldest due is kept');
  assert.ok(!picked.includes(due[0].id), 'newest due waits');
});

test('archived reminders never show', () => {
  const a = make({ archived: true, nextDue: D });
  assert.deepEqual(pickForDay([a], D), []);
});

test('undo restores the schedule', () => {
  const r = make({ nextDue: D });
  const prev = markDone(r, D, seq(0));
  assert.equal(r.nextDue, addDays(D, 3));
  undoDone(r, prev);
  assert.equal(r.nextDue, D);
});

test('old reminders without schedule fields are due now', () => {
  const old = { id: 'old', text: 'Stay calm', archived: false };
  assert.deepEqual(pickForDay([old], D), ['old']);
});
