import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditRiverWaterPolicySources, catalogueResources, inspectRiverPolicyCsv, riverPolicyHash, type RiverPolicyManifest } from '../scripts/auditRiverWaterPolicySources';
import { acceptRiverPolicyStage, fetchRiverWaterPolicySources } from '../scripts/fetchRiverWaterPolicySources';

const root = process.cwd(), manifestPath = 'data/raw/river-water-policy/source-manifest.json';
const load = async (): Promise<RiverPolicyManifest> => JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));

test('accepted annual sources audit original bytes and preserve current/historical editions', async () => {
  const m = await auditRiverWaterPolicySources();
  assert.equal(m.sources.reduce((n, s) => n + s.publishedRowCount, 0), 768);
  assert.equal(m.sources.reduce((n, s) => n + s.observedRowCount, 0), 720);
  assert.equal(m.sources[3].placeholderCount, 32);
  assert.deepEqual(m.sources.map(s => s.historicalComparison.identical), [true, true, true, false]);
  assert.equal(m.stationAudit.filter(s => s.identityStatus === 'label_verified').length, 15);
  assert.equal(m.stationAudit.find(s => s.stationName === '青礜溪')?.identityStatus, 'unmatched');
  assert.ok(m.stationAudit.every(s => s.physicalContinuity === 'unverified' && s.coordinateStatus === 'unverified'));
});

test('source admission rejects tampered identities, editions, bytes, schemas and encodings', async () => {
  const changes: Array<(m: RiverPolicyManifest) => void> = [
    m => { m.sources[0].resourceId = m.sources[1].resourceId; },
    m => { m.sources[0].sha256 = '0'.repeat(64); },
    m => { m.sources[0].byteLength += 1; },
    m => { m.sources[0].columns[0] = 'unknown'; },
    m => { m.sources[0].encoding = 'UTF-8'; },
    m => { m.sources[0].year = m.sources[1].year; },
    m => { m.sources[0].localPath = '../outside.csv'; },
    m => { m.stationAudit[0].identityStatus = 'ambiguous'; },
    m => { m.sources[0].observedRowCount = 0; },
    m => { m.context[2].sourceUrl = 'https://example.com'; },
  ];
  for (const change of changes) { const m = await load(); change(m); await assert.rejects(auditRiverWaterPolicySources(root, m)); }
});

test('successful refresh only stages source-governed bytes until exact offline acceptance', async t => {
  const directory = await mkdtemp(path.join(root, '.river-policy-source-'));
  t.after(() => { assert.ok(path.resolve(directory).startsWith(path.resolve(root) + path.sep)); return rm(directory, { recursive: true, force: true }); });
  await cp(path.join(root, 'data/raw/river-water-policy'), path.join(directory, 'data/raw/river-water-policy'), { recursive: true });
  await cp(path.join(root, 'data/raw/river-water-quality'), path.join(directory, 'data/raw/river-water-quality'), { recursive: true });
  const manifest = await load(), before = await readFile(path.join(directory, manifestPath));
  const resources = new Map(await Promise.all([...manifest.context.map(c => ({ url: c.sourceUrl, localPath: c.localPath })), ...manifest.sources.map(s => ({ url: s.downloadUrl, localPath: s.localPath }))].map(async r => [r.url, await readFile(path.join(root, r.localPath))] as const)));
  const network = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const bytes = resources.get(String(input));
    assert.ok(bytes, 'Only selected official source URLs are requested');
    return new Response(bytes);
  });
  await fetchRiverWaterPolicySources([], directory);
  assert.equal(network.mock.callCount(), 0);
  await fetchRiverWaterPolicySources(['--refresh'], directory);
  assert.equal(network.mock.callCount(), 8);
  assert.deepEqual(await readFile(path.join(directory, manifestPath)), before);
});

test('CSV admission requires official units, valid months and complete schema', async () => {
  const m = await load(), bytes = await readFile(path.join(root, m.sources[0].localPath));
  const decoded = new TextDecoder('big5').decode(bytes);
  assert.throws(() => inspectRiverPolicyCsv(Buffer.from(decoded.replace('溶氧量數值（mg/l）', '溶氧量數值（ug/l）')), 2023, m.analysisDate), /schema|unit/);
  assert.throws(() => inspectRiverPolicyCsv(Buffer.from('月份,序號\n1,1\n'), 2023, m.analysisDate), /schema/);
  assert.throws(() => inspectRiverPolicyCsv(Buffer.from(decoded.replace(/\r?\n1,/, '\n13,')), 2023, m.analysisDate), /month/);
  assert.throws(() => catalogueResources('<html>missing official metadata</html>'), /metadata/);
});

test('exact offline staged acceptance rejects corruption and failed refresh preserves accepted bytes', async t => {
  const directory = await mkdtemp(path.join(root, '.river-policy-source-'));
  t.after(() => { assert.ok(path.resolve(directory).startsWith(path.resolve(root) + path.sep)); return rm(directory, { recursive: true, force: true }); });
  await cp(path.join(root, 'data/raw/river-water-policy'), path.join(directory, 'data/raw/river-water-policy'), { recursive: true });
  const before = await readFile(path.join(directory, manifestPath));
  const hash = riverPolicyHash(before), staged = path.join(directory, `data/raw/river-water-policy/staged-${hash}.json`);
  await writeFile(staged, before);
  const network = t.mock.method(globalThis, 'fetch', async () => { throw new Error('network intentionally unavailable'); });
  await acceptRiverPolicyStage(directory, hash);
  assert.equal(network.mock.callCount(), 0);
  await writeFile(staged, Buffer.concat([before, Buffer.from(' ')]));
  await assert.rejects(acceptRiverPolicyStage(directory, hash), /hash mismatch/);
  assert.deepEqual(await readFile(path.join(directory, manifestPath)), before);
  await assert.rejects(fetchRiverWaterPolicySources(['--refresh'], directory), /network intentionally unavailable/);
  assert.deepEqual(await readFile(path.join(directory, manifestPath)), before);
  await assert.rejects(fetchRiverWaterPolicySources(['--accept'], directory), /explicit/);
  await assert.rejects(fetchRiverWaterPolicySources(['--refresh', `--accept=${hash}`], directory), /offline/);
});
