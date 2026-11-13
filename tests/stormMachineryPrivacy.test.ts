import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const directory = 'data/storm-rainfall-rented-machinery-sites';
const machineryPaths = [`${directory}/records.json`, `${directory}/sites.geojson`];

test('public machinery downloads publish only the expected site fields', async () => {
  const records = JSON.parse(await readFile(`public/${machineryPaths[0]}`, 'utf8'));
  const geojson = JSON.parse(await readFile(`public/${machineryPaths[1]}`, 'utf8'));
  const fields = [
    'id', 'objectId', 'districtRaw', 'districtName', 'equipmentId', 'locationDescription',
    'equipmentNameRaw', 'equipmentType', 'contractorName', 'recordDateRaw', 'recordDate',
    'usageDirectionRaw', 'usageDirection', 'longitudeRaw', 'latitudeRaw', 'longitude', 'latitude',
    'hasValidCoordinates', 'hasEquipmentId', 'hasContractor', 'hasUsageDirection',
  ].sort();
  assert.ok(records.length > 0);
  for (const record of records) assert.deepEqual(Object.keys(record).sort(), fields);
  assert.deepEqual(
    geojson.features.map((feature: { properties: unknown }) => feature.properties),
    records.filter((record: { hasValidCoordinates: boolean }) => record.hasValidCoordinates),
  );
});

test('worker refreshes both machinery caches without adding URLs to its precache', async () => {
  const scope = 'https://example.test/taipei-feitsui-water-map/';
  const batches: Request[][] = [];
  let install: ((event: { waitUntil: (promise: Promise<unknown>) => void }) => void) | undefined;
  const context = vm.createContext({
    self: {
      registration: { scope },
      addEventListener: (name: string, callback: typeof install) => {
        if (name === 'install') install = callback;
      },
    },
    URL, Request,
    caches: { open: async () => ({
      addAll: async (entries: Array<Request | URL>) => {
        batches.push(Array.from(entries, entry => new Request(entry)));
      },
    }) },
  });
  vm.runInContext(await readFile('public/sw.js', 'utf8'), context);
  let completion: Promise<unknown> | undefined;
  install!({ waitUntil: promise => { completion = promise; } });
  await completion;
  const requests = batches.flat();
  for (const path of machineryPaths) {
    const matches = requests.filter(request => request.url === new URL(path, scope).href);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].cache, 'reload');
  }
});
