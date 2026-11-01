import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTypedRef } from '../js/books.js';

test('reads what people type', () => {
  const cases = {
    'John 3:16': 'JHN 3:16', 'phil 4:6-7': 'PHP 4:6-7', '1 Cor 13': '1CO 13', 'Ps 23:1–3': 'PSA 23:1-3',
    'Psalm 46:10': 'PSA 46:10', 'I John 1:9': '1JN 1:9', '1jn 4:18': '1JN 4:18', 'Philemon 1:6': 'PHM 1:6',
    'Jude 1:24': 'JUD 1:24', 'Judges 6': 'JDG 6', 'Rom. 8:28': 'ROM 8:28', 'song 2:4': 'SNG 2:4',
    'Lam 3:22-23': 'LAM 3:22-23', 'isaiah 40 : 31': 'ISA 40:31', 'JHN 1:1': 'JHN 1:1',
  };
  for (const [input, want] of Object.entries(cases)) assert.equal(parseTypedRef(input), want, input);
});

test('rejects what it cannot place', () => {
  for (const bad of ['Jo 3:16', 'John 22:1', 'hello', '3:16', 'Obadiah 2']) assert.equal(parseTypedRef(bad), null, bad);
});
