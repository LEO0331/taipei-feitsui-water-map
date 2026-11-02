import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('offline hashed modules tolerate Origin variance without relaxing data or cross-origin cache matching', async () => {
  let listener: (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void;
  let options: CacheQueryOptions | undefined;
  const context = vm.createContext({
    self: { registration: { scope: 'https://example.test/taipei-feitsui-water-map/' }, addEventListener: (name: string, fn: typeof listener) => { if (name === 'fetch') listener = fn; } },
    URL, Response,
    caches: { match: async (_request: Request, value?: CacheQueryOptions) => { options = value; return new Response('cached'); } },
    fetch: async () => { throw new Error('Offline'); },
  });
  vm.runInContext(await readFile('public/sw.js', 'utf8'), context);
  for (const [path, ignoreVary] of [
    ['https://example.test/taipei-feitsui-water-map/assets/Panel-123.js', true],
    ['https://example.test/taipei-feitsui-water-map/assets/Panel-123.css', true],
    ['https://example.test/taipei-feitsui-water-map/data/current.json', false],
    ['https://other.test/taipei-feitsui-water-map/assets/Panel-123.js', false],
    ['https://example.test/other/assets/Panel-123.js', false],
  ] as const) {
    let response: Promise<Response> | undefined;
    listener!({ request: new Request(path), respondWith: value => { response = value; } });
    assert.equal(await (await response!).text(), 'cached');
    assert.equal(options?.ignoreVary === true, ignoreVary);
  }
});
