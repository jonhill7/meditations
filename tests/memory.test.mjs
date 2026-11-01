import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, finishLearning, grade, isDue, preview, cardLabel, verseKeys, maskWords, MIN_EASE } from '../js/memory.js';
import { TMS_VERSES } from '../js/tms.js';
import { parseRef } from '../js/books.js';
import { addDays } from '../js/reflections.js';

const D = '2026-11-01';
const mid = () => 0.5;

test('Topical Memory System has 60 valid verses in 5 packs', () => {
  assert.equal(TMS_VERSES.length, 60);
  assert.equal(new Set(TMS_VERSES.map(v => v.pack)).size, 5);
  for (const v of TMS_VERSES) for (const r of v.refs) assert.ok(parseRef(r)?.verse, r);
});

test('learning, then gaps grow with good recalls', () => {
  const c = newCard(['JHN 3:16'], D);
  assert.ok(!isDue(c, D));
  finishLearning(c, D);
  assert.equal(c.due, addDays(D, 1));
  let date = c.due;
  const gaps = [];
  for (let i = 0; i < 5; i++) {
    grade(c, 'good', date, mid);
    gaps.push(c.interval);
    date = c.due;
  }
  assert.equal(gaps[0], 3);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], gaps.join(','));
});

test('a miss resets to tomorrow and lowers ease, never below the floor', () => {
  const c = newCard(['ROM 8:28'], D);
  finishLearning(c, D);
  grade(c, 'good', D, mid);
  for (let i = 0; i < 20; i++) grade(c, 'again', D, mid);
  assert.equal(c.interval, 1);
  assert.equal(c.ease, MIN_EASE);
  assert.equal(c.lapses, 20);
});

test('easy beats good beats hard', () => {
  const c = newCard(['ROM 8:28'], D);
  finishLearning(c, D);
  grade(c, 'good', D, mid);
  grade(c, 'good', D, mid);
  const h = preview(c, 'hard').interval, g = preview(c, 'good').interval, e = preview(c, 'easy').interval;
  assert.ok(h < g && g < e, `${h} ${g} ${e}`);
});

test('labels and highlight keys for split references', () => {
  const c = newCard(['PSA 119:9', 'PSA 119:11'], D);
  assert.equal(cardLabel(c), 'Psalm 119:9, 11');
  assert.deepEqual(verseKeys(c), ['PSA 119:9', 'PSA 119:11']);
  assert.deepEqual(verseKeys(newCard(['PHP 4:6-7'], D)), ['PHP 4:6', 'PHP 4:7']);
});

test('masking hides more each stage and is stable', () => {
  const text = 'For God so loved the world that he gave his only Son';
  const hidden = s => maskWords(text, s, 42).filter(w => w.hidden).length;
  assert.equal(hidden(0), 0);
  assert.ok(hidden(1) < hidden(2));
  assert.equal(hidden(4), 12);
  assert.deepEqual(maskWords(text, 2, 42), maskWords(text, 2, 42));
});
