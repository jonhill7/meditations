import { BOOK } from './books.js';

// "Two Tracks" plan: about 748 days, two chapters a day.
//
// Track 1 walks the Old Testament (minus Psalms and Proverbs) roughly in
// order, with heavy books interleaved with lighter narrative: Leviticus
// alternates day by day with Joshua and Ruth, Numbers with Judges,
// Deuteronomy with Job, Kings with Ecclesiastes and Song of Songs,
// Chronicles with Ezra, Nehemiah and Esther, and the major prophets with
// Daniel and the minor prophets.
//
// Track 2 reads the New Testament twice: the first time with the Psalms
// woven through it, the second time with Proverbs. It finishes about seven
// weeks before Track 1, so the last weeks are one chapter a day.

export const PLAN_ID = 'two-tracks-v1';
export const PLAN_NAME = 'Two Tracks';

function chapters(...codes) {
  return codes.flatMap(code => Array.from({ length: BOOK[code].chapters }, (_, i) => [code, i + 1]));
}

// Spreads the shorter list evenly through the longer one, keeping both in order.
export function weave(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    const takeA = j >= b.length || (i < a.length && (i + 0.5) / a.length <= (j + 0.5) / b.length);
    out.push(takeA ? a[i++] : b[j++]);
  }
  return out;
}

const NT = ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL',
  '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];
const MINOR = ['DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];

export function trackOne() {
  return [
    ...chapters('GEN', 'EXO'),
    ...weave(chapters('LEV'), chapters('JOS', 'RUT')),
    ...weave(chapters('NUM'), chapters('JDG')),
    ...weave(chapters('DEU'), chapters('JOB')),
    ...chapters('1SA', '2SA'),
    ...weave(chapters('1KI', '2KI'), chapters('ECC', 'SNG')),
    ...weave(chapters('1CH', '2CH'), chapters('EZR', 'NEH', 'EST')),
    ...weave(chapters('ISA', 'JER', 'LAM', 'EZK'), chapters(...MINOR)),
  ];
}

export function trackTwo() {
  return [
    ...weave(chapters(...NT), chapters('PSA')),
    ...weave(chapters(...NT), chapters('PRO')),
  ];
}

let cached;
// Returns an array of days; each day is a list of [bookCode, chapter] pairs.
export function buildPlan() {
  if (cached) return cached;
  const one = trackOne();
  const two = trackTwo();
  const length = Math.max(one.length, two.length);
  cached = Array.from({ length }, (_, d) => [one[d], two[d]].filter(Boolean));
  return cached;
}
