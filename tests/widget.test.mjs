import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeVerseRefs, feedText, toggle } from '../js/widget.js';

test('adjacent pinned verses become one passage, in Bible order', () => {
  assert.deepEqual(mergeVerseRefs(['JHN 3:17', 'ROM 8:28', 'JHN 3:16', 'JHN 3:18', 'JHN 3:21']), ['JHN 3:16-18', 'JHN 3:21', 'ROM 8:28']);
  assert.deepEqual(mergeVerseRefs(['PHP 4:6-7', 'PHP 4:8']), ['PHP 4:6-8']);
  assert.deepEqual(mergeVerseRefs(['GEN 1:1', 'GEN 1:1']), ['GEN 1:1']);
});

test('feed text lists scripture with titles and personal items as bullets', () => {
  const text = feedText([
    { kind: 'verse', title: 'John 3:16', text: 'For God so loved' },
    { kind: 'reflection', text: 'Stay calm.' },
  ]);
  assert.equal(text, 'John 3:16\nFor God so loved\n\n• Stay calm.');
});

test('toggle adds then removes', () => {
  const l = [];
  assert.equal(toggle(l, 'a'), true);
  assert.equal(toggle(l, 'a'), false);
  assert.deepEqual(l, []);
});

test('feedRich formats for KWGT and escapes brackets', async () => {
  const { feedRich } = await import('../js/widget.js');
  const r = feedRich([
    { kind: 'verse', title: 'John 3:16', text: 'For God [so] loved', tr: 'BSB' },
    { kind: 'memory', title: 'Romans 8:28', text: 'And we know', tr: 'ESV' },
    { kind: 'reflection', text: 'Stay calm' },
    { kind: 'prayer', text: 'Wisdom' },
  ], 'Friday, November 6');
  const assert = (await import('node:assert')).default;
  assert.match(r, /^\[s=0\.75\]\[c=#[0-9A-F]+\]FRIDAY, NOVEMBER 6/);
  assert.match(r, /For God \(so\) loved/);
  const order = ['TODAY\'S READING', 'John 3:16', 'PRAYER', '• Wisdom', 'REFLECT', '• Stay calm', 'MEMORY', 'Romans 8:28'].map(x => r.indexOf(x));
  assert.ok(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), r);
  assert.match(feedRich([], 'Friday'), /Nothing chosen yet today/);
});

test('feedRich can hide memory verse text', async () => {
  const { feedRich, kwgtFormula } = await import('../js/widget.js');
  const items = [{ kind: 'memory', title: 'Romans 8:28', text: 'And we know', tr: 'ESV' }];
  const hidden = feedRich(items, 'Friday', { hideMemory: true });
  assert.match(hidden, /Romans 8:28/);
  assert.doesNotMatch(hidden, /And we know/);
  assert.match(feedRich(items, 'Friday'), /And we know/);
  assert.match(kwgtFormula('https://x/widget/abc'), /gv\(hidememory\) = 1, wg\("https:\/\/x\/widget\/abc", json, \.richHidden\)/);
});
