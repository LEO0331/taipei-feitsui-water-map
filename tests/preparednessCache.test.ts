import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('PWA refreshes a versioned decision snapshot at the Pages base and retains known-good offline data', async () => {
  const listeners = new Map<string, (event: { request: Request; respondWith: (value: Promise<Response>) => void }) => void>();
  let stored: Response | undefined;
  let network: Response | Error;
  const value = (version: string) => new Response(JSON.stringify({ schemaVersion: '1.0.0', methodologyVersion: 'heavy-rain-preparedness-review-v1', snapshotVersion: `sha256-${version.repeat(16)}` }));
  const context = vm.createContext({
    self: { registration: { scope: 'https://example.test/taipei-feitsui-water-map/' }, addEventListener: (name: string, callback: typeof listeners extends Map<string, infer T> ? T : never) => listeners.set(name, callback) },
    URL, Response, caches: { match: async () => stored?.clone(), open: async () => ({ put: async (_request: Request, response: Response) => { stored = response; } }) },
    fetch: async (_request: Request, options: RequestInit) => { assert.equal(options.cache, 'no-store'); if (network instanceof Error) throw network; return network; },
  });
  vm.runInContext(await readFile('public/sw.js', 'utf8'), context);
  async function request() {
    let response: Promise<Response> | undefined;
    listeners.get('fetch')!({ request: new Request('https://example.test/taipei-feitsui-water-map/data/preparedness-decision/snapshot.json'), respondWith: promise => { response = promise; } });
    return (await response!).json();
  }
  network = value('a'); assert.equal((await request()).snapshotVersion, 'sha256-' + 'a'.repeat(16));
  network = value('b'); assert.equal((await request()).snapshotVersion, 'sha256-' + 'b'.repeat(16));
  network = new Error('Offline'); assert.equal((await request()).snapshotVersion, 'sha256-' + 'b'.repeat(16));
  network = new Response('{"schemaVersion":"unknown"}'); assert.equal((await request()).snapshotVersion, 'sha256-' + 'b'.repeat(16));
});
