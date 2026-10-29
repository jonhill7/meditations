// Offline support. Bump VERSION whenever app files change so phones pick up
// the new version.
const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const DATA = 'data-v1';

const SHELL_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/bible.js', 'js/books.js', 'js/plan.js', 'js/store.js', 'js/ui.js', 'js/votd.js',
  'js/views/today.js', 'js/views/read.js', 'js/views/prayers.js', 'js/views/reflect.js',
  'js/views/progress.js', 'js/views/notes.js', 'js/views/settings.js', 'js/views/plan.js',
];
const BOOKS = ('GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ' +
  'ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ' +
  'ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV').split(' ');
const DATA_FILES = BOOKS.flatMap(b => [`data/bsb/${b}.json`, `data/xref/${b}.json`]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    // The Bible text and cross references (about 6 MB) are cached once and
    // kept across app updates. A file that fails now is fetched on first use.
    const data = await caches.open(DATA);
    await Promise.allSettled(DATA_FILES.map(async f => (await data.match(f)) || data.add(f)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL, DATA, 'esv-v1', 'commentary-v1'];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith((async () => {
    const hit = await caches.match(event.request, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(event.request);
    if (res.ok && url.pathname.includes('/data/')) (await caches.open(DATA)).put(event.request, res.clone());
    return res;
  })());
});
