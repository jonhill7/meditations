// The service worker serves the app shell cache-first, so a file missing from
// SHELL_FILES works online (until the first offline morning) and then breaks
// the app. These checks keep sw.js's lists in step with the files on disk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');

function arrayLiteral(name) {
  const m = sw.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `sw.js declares ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(ROOT, dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(relative(ROOT, path)));
    else out.push(relative(ROOT, path).split(sep).join('/'));
  }
  return out;
}

const shell = arrayLiteral('SHELL_FILES');

test('every app script, stylesheet and icon is precached', () => {
  const needed = [...filesUnder('js'), ...filesUnder('css'), ...filesUnder('icons'), 'index.html', 'manifest.webmanifest'];
  const missing = needed.filter(f => !shell.includes(f));
  assert.deepEqual(missing, [], 'add these to SHELL_FILES in sw.js');
});

test('every precached shell file exists', () => {
  const gone = shell.filter(f => f !== './' && !existsSync(join(ROOT, f)));
  assert.deepEqual(gone, [], 'remove these from SHELL_FILES in sw.js, or restore them');
});

test('every Bible data file the worker caches exists', () => {
  const books = sw.match(/const BOOKS = \(([\s\S]*?)\)\.split/)[1].match(/[0-9A-Z]{3}/g);
  assert.equal(books.length, 66);
  const sets = sw.match(/data\/(\w+)\/\$\{b\}\.json/g).map(s => s.split('/')[1]);
  assert.ok(sets.length > 0);
  const gone = books.flatMap(b => sets.map(s => `data/${s}/${b}.json`)).filter(f => !existsSync(join(ROOT, f)));
  assert.deepEqual(gone, []);
});
