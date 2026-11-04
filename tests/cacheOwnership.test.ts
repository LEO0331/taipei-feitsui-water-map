import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('water worker activation expires only its own historical caches on shared Pages origin', async () => {
  const keys = ['feitsui-water-map-v9', 'feitsui-water-map-v1', 'feitsui-water-map-0123456789abcdef', 'taipei-safety-map-v7', 'taipei-friendly-food-map-v4', 'portfolio-cache-v1', 'unrelated-offline-cache'];
  const deleted: string[] = [];
  let activate: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void;
  vm.runInNewContext(await readFile('public/sw.js', 'utf8'), {
    self: { registration: { scope: 'https://leo0331.github.io/taipei-feitsui-water-map/' }, addEventListener: (name: string, handler: typeof activate) => { if (name === 'activate') activate = handler; } },
    URL,
    caches: { keys: async () => keys, delete: async (name: string) => { deleted.push(name); return true; } },
  });
  let done: Promise<unknown> | undefined;
  activate!({ waitUntil: value => { done = value; } });
  await done;
  assert.deepEqual(deleted.sort(), ['feitsui-water-map-v1', 'feitsui-water-map-0123456789abcdef'].sort());
});
