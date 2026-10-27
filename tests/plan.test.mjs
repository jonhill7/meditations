import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan, trackOne, trackTwo, weave } from '../js/plan.js';
import { BOOKS } from '../js/books.js';

test('weave keeps both lists in order and loses nothing', () => {
  const out = weave([1, 2, 3, 4], ['a', 'b']);
  assert.deepEqual(out.filter(x => typeof x === 'number'), [1, 2, 3, 4]);
  assert.deepEqual(out.filter(x => typeof x === 'string'), ['a', 'b']);
});

test('plan covers every chapter of the Bible', () => {
  const seen = new Map();
  for (const day of buildPlan()) for (const [b, c] of day) seen.set(`${b} ${c}`, (seen.get(`${b} ${c}`) ?? 0) + 1);
  for (const book of BOOKS) for (let c = 1; c <= book.chapters; c++) assert.ok(seen.has(`${book.code} ${c}`), `${book.code} ${c}`);
  assert.equal(seen.size, 1189);
});

test('Old Testament once, New Testament twice', () => {
  assert.equal(trackOne().length, 748);
  assert.equal(trackTwo().length, 260 * 2 + 150 + 31);
  assert.equal(buildPlan().length, 748);
});

test('Leviticus never runs two days in a row', () => {
  const t = trackOne();
  for (let i = 1; i < t.length; i++) assert.ok(!(t[i][0] === 'LEV' && t[i - 1][0] === 'LEV'), `day ${i}`);
});
