import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fetchCarlsonTrophicStateIndex } from '../scripts/fetchCarlsonTrophicStateIndex';
import { fetchTapWaterBusinessKeyMetrics } from '../scripts/fetchTapWaterBusinessKeyMetrics';
import { fetchTreatmentPlantClearWaterQuality } from '../scripts/fetchTreatmentPlantClearWaterQuality';

const resourceUrl = 'https://data.taipei/api/v1/dataset/example/resource/example?scope=resourceAquire';
const sources = [
  ['carlson-trophic-state-index', '臺北翡翠水庫卡爾森優養指數.csv', fetchCarlsonTrophicStateIndex],
  ['tap-water-business-key-metrics', '臺北自來水事業處業務關鍵數據.csv', fetchTapWaterBusinessKeyMetrics],
  ['tap-water-treatment-plant-clear-water-quality', '臺北自來水事業處各淨水場清水水質.csv', fetchTreatmentPlantClearWaterQuality],
] as const;

test('manual refresh retains accepted data on bad responses and publishes validated original bytes', async t => {
  const directory = await mkdtemp(path.join(process.cwd(), '.manual-csv-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(process.cwd()));
    return rm(directory, { recursive: true, force: true });
  });
  let page = () => new Response(resourceUrl);
  let resource = () => new Response('<html>Unavailable</html>');
  const network = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.ok(init?.signal instanceof AbortSignal);
    return url === resourceUrl ? resource() : page();
  });
  for (const [dataset, targetFile, refresh] of sources) {
    const source = path.join(process.cwd(), 'data/raw', dataset);
    const sourceFile = (await readdir(source)).find(file => file.endsWith('.csv'));
    assert.ok(sourceFile);
    const accepted = await readFile(path.join(source, sourceFile));
    const raw = path.join(directory, 'data/raw', dataset);
    const csv = path.join(raw, targetFile);
    const metadata = path.join(raw, 'source-metadata.json');
    await mkdir(raw, { recursive: true });
    await writeFile(csv, 'existing CSV');
    await writeFile(metadata, 'existing metadata');

    network.mock.resetCalls();
    await refresh(directory);
    assert.equal(network.mock.callCount(), 0);
    assert.equal(await readFile(csv, 'utf8'), 'existing CSV');
    const priorMetadata = await readFile(metadata);

    page = () => new Response(null, { status: 503 });
    await assert.rejects(refresh(directory, true), /HTTP 503/);
    page = () => new Response(resourceUrl);
    resource = () => new Response(accepted, { status: 404 });
    await assert.rejects(refresh(directory, true), /HTTP 404/);
    resource = () => new Response(accepted, { status: 206 });
    await assert.rejects(refresh(directory, true), /HTTP 206/);
    resource = () => new Response('<html>Unavailable</html>');
    await assert.rejects(refresh(directory, true), /expected dataset/);
    resource = () => new Response(Buffer.concat([accepted, Buffer.from('\n"unfinished')]));
    await assert.rejects(refresh(directory, true), /Unclosed CSV field/);
    resource = () => new Response(Buffer.concat([accepted, Buffer.from('\nincomplete,row')]));
    await assert.rejects(refresh(directory, true), /CSV field count mismatch/);
    resource = () => new Response(new Uint8Array(8 * 1024 * 1024 + 1));
    await assert.rejects(refresh(directory, true), /download limit/);
    assert.equal(await readFile(csv, 'utf8'), 'existing CSV');
    assert.deepEqual(await readFile(metadata), priorMetadata);

    resource = () => new Response(accepted);
    await refresh(directory, true);
    assert.deepEqual(await readFile(csv), accepted);
    assert.deepEqual((await readdir(raw)).sort(), ['source-metadata.json', targetFile].sort());
    assert.deepEqual(JSON.parse(await readFile(metadata, 'utf8')).files[0].file, targetFile);
  }
});
