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
