import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../proxy/worker.js';

const env = { API_BIBLE_KEY: 'secret', TRANSLATIONS: 'NIV', ALLOWED_ORIGINS: 'https://jonhill7.github.io' };
const NIV = { id: 'niv-id', abbreviationLocal: 'NIV', name: 'NIV' };
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, key: init?.headers?.['api-key'] });
  if (url.includes('/bibles?')) return new Response(JSON.stringify({ data: [NIV, { id: 'other', abbreviation: 'XYZ', name: 'Other' }] }));
  return new Response(JSON.stringify({ data: { content: '[1] text', copyright: 'c' } }));
};
const req = (path, origin = 'https://jonhill7.github.io') =>
  new Request(`https://proxy.example${path}`, { headers: origin ? { Origin: origin } : {} });

test('lists only the shared translations', async () => {
  const res = await worker.fetch(req('/v1/bibles'), env);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data.map(b => b.id), ['niv-id']);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://jonhill7.github.io');
});

test('serves a chapter with the secret key and filtered params', async () => {
  const res = await worker.fetch(req('/v1/bibles/niv-id/chapters/JHN.3?content-type=text&evil=1'), env);
  assert.equal(res.status, 200);
  const last = calls.at(-1);
  assert.equal(last.key, 'secret');
  assert.ok(last.url.endsWith('/bibles/niv-id/chapters/JHN.3?content-type=text'), last.url);
  assert.ok(!(await res.text()).includes('secret'));
});

test('refuses other origins, other translations and other paths', async () => {
  assert.equal((await worker.fetch(req('/v1/bibles', 'https://evil.example'), env)).status, 403);
  assert.equal((await worker.fetch(req('/v1/bibles', null), env)).status, 403);
  assert.equal((await worker.fetch(req('/v1/bibles/other/chapters/JHN.3'), env)).status, 403);
  assert.equal((await worker.fetch(req('/v1/bibles/niv-id/books'), env)).status, 404);
});

test('widget feeds: the app writes, anyone with the token reads', async () => {
  const store = new Map();
  const kv = { get: async k => store.get(k) ?? null, put: async (k, v, o) => { assert.equal(o.expirationTtl, 259200); store.set(k, v); } };
  const e = { ...env, WIDGET: kv };
  const token = 'a'.repeat(32);
  const put = (origin, body) => worker.fetch(new Request(`https://proxy.example/widget/${token}`, { method: 'PUT', body, headers: origin ? { Origin: origin } : {} }), e);
  assert.equal((await put('https://jonhill7.github.io', JSON.stringify({ text: 'hi' }))).status, 200);
  assert.equal((await put('https://evil.example', '{}')).status, 403);
  assert.equal((await put(null, '{}')).status, 403);
  assert.equal((await put('https://jonhill7.github.io', 'x'.repeat(20000))).status, 413);
  const got = await worker.fetch(new Request(`https://proxy.example/widget/${token}`), e);
  assert.equal((await got.json()).text, 'hi');
  const missing = await worker.fetch(new Request(`https://proxy.example/widget/${'b'.repeat(32)}`), e);
  assert.equal((await missing.json()).count, 0);
  assert.equal((await worker.fetch(new Request('https://proxy.example/widget/short'), e)).status, 403);
});
