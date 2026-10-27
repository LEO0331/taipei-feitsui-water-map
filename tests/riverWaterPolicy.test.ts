import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildRiverWaterPolicySnapshot, policyRowsFromCsv, buildPolicyComparisons } from '../scripts/buildRiverWaterPolicySnapshot';
import { classifyPolicyRow, officialRpiPoints, RPI_KEYS, validPolicyValue, validatePolicyPointer, validatePolicySnapshot, verifyPolicyBytes } from '../src/utils/riverWaterPolicy';
import { parseRiverWaterQualityValue, riverColumnMap } from '../src/utils/riverWaterQuality';
import { riverIndicatorKeys } from '../src/types/riverWaterQuality';
import type { PolicyRow, PolicySnapshot } from '../src/types/riverWaterPolicy';

const built = buildRiverWaterPolicySnapshot(process.cwd(), false);
function values(raw = ''): PolicyRow['values'] {
  return Object.fromEntries(riverIndicatorKeys.map(key => [key, parseRiverWaterQualityValue(raw, riverColumnMap[key].unit)])) as PolicyRow['values'];
}
test('published rows are separated from observations, current-month empties and future placeholders', async () => {
  const { snapshot } = await built;
  assert.equal(snapshot.totals.publishedRowCount, 768);
  assert.equal(snapshot.totals.observedRowCount, 720);
  assert.equal(snapshot.totals.futurePlaceholderCount, 32);
  assert.equal(snapshot.rows.filter(row => row.status === 'present_no_indicators').length, 16);
  assert.equal(snapshot.rows.filter(row => row.status === 'historical_missing').length, 0);
  assert.equal(snapshot.totals.expectedStationMonthCount, 736);
  assert.ok(snapshot.rows.filter(row => row.status === 'future_placeholder').every(row => Object.values(row.values).every(cell => cell.value === undefined)));
});
test('source cutoff is data-driven and never hardcodes November as missing', () => {
  const empty = values(), measured = values('1');
  assert.equal(classifyPolicyRow(empty, '2026-11', '2026-10-27'), 'future_placeholder');
  assert.equal(classifyPolicyRow(empty, '2026-09', '2026-10-27'), 'historical_missing');
  assert.equal(classifyPolicyRow(empty, '2026-10', '2026-10-27'), 'present_no_indicators');
  assert.equal(classifyPolicyRow(measured, '2026-11', '2026-12-01'), 'valid_observed');
  assert.equal(classifyPolicyRow(measured, '2026-11', '2026-10-27'), 'unparseable');
  const invalid = values(); invalid.ammoniaNitrogenMgL = parseRiverWaterQualityValue('-1', 'mg/L');
  assert.equal(classifyPolicyRow(invalid, '2026-11', '2026-10-27'), 'unparseable');
  invalid.ammoniaNitrogenMgL = parseRiverWaterQualityValue('ND<-0.1', 'mg/L');
  assert.equal(classifyPolicyRow(invalid, '2026-09', '2026-10-27'), 'unparseable');
  assert.equal(classifyPolicyRow(invalid, '2026-11', '2026-10-27'), 'unparseable');
  const malformed = values(); malformed.dissolvedOxygenMgL = parseRiverWaterQualityValue('malformed', 'mg/L');
  assert.equal(classifyPolicyRow(malformed, '2026-11', '2026-10-27'), 'unparseable');
});
test('censoring and missingness retain raw qualifiers without imputation', () => {
  for (const [raw, qualifier] of [['ND<0.02', 'not_detected_below'], ['<10', 'not_detected_below'], ['---', 'not_measured'], ['', 'missing'], ['malformed', 'unparsed']] as const) {
    const parsed = parseRiverWaterQualityValue(raw, 'mg/L');
    assert.equal(parsed.qualifier, qualifier); assert.equal(parsed.value, undefined);
  }
  assert.equal(parseRiverWaterQualityValue('6.50E+03').value, 6500);
  assert.equal(parseRiverWaterQualityValue('ND<0.02').detectionLimit, 0.02);
  assert.equal(validPolicyValue(parseRiverWaterQualityValue('-1', 'mg/L'), 'ammoniaNitrogenMgL'), false);
  assert.equal(validPolicyValue(parseRiverWaterQualityValue('4', 'μg/L'), 'ammoniaNitrogenMgL'), false);
  assert.equal(validPolicyValue(parseRiverWaterQualityValue('15'), 'ph'), false);
});
test('all duplicate station-period source rows are excluded, never last-row-wins', async () => {
  const { snapshot } = await built, source = snapshot.sources[0], station = snapshot.stations[0];
  const raw = { '月份': '1', '河川名稱': station.riverName, '監測站': station.stationName, ...Object.fromEntries(riverIndicatorKeys.map(key => [riverColumnMap[key].column, '1'])) };
  const rows = policyRowsFromCsv(source, [raw, raw], snapshot.stations, snapshot.analysisDate);
  assert.equal(new Set(rows.map(row => row.id)).size, 2);
  assert.ok(rows.every(row => row.status === 'duplicate' && row.issues.includes('duplicate_period') && !row.completeFourIndicators));
  const invalid = policyRowsFromCsv(source, [{ ...raw, '月份': '13' }], snapshot.stations, snapshot.analysisDate)[0];
  assert.equal(invalid.status, 'unparseable'); assert.ok(invalid.issues.includes('invalid_period'));
});
test('unknown source station cannot be silently merged by its name or river', async () => {
  const { snapshot } = await built;
  assert.throws(() => policyRowsFromCsv(snapshot.sources[0], [{ '月份': '1', '河川名稱': 'another river', '監測站': snapshot.stations[0].stationName }], snapshot.stations, snapshot.analysisDate), /Unadmitted station/);
  assert.equal(snapshot.stations.filter(station => station.identityStatus === 'unmatched').length, 1);
  assert.ok(snapshot.stations.every(station => station.physicalContinuity === 'unverified' && station.coordinateStatus !== 'verified'));
});
test('RPI official point goldens preserve table boundaries and precision gaps', () => {
  // Independent golden values transcribed from MOENV Pedia_37 table, admitted as raw HTML.
  const goldens = [
    ['dissolvedOxygenMgL', 6.5, 1], ['dissolvedOxygenMgL', 4.6, 3], ['dissolvedOxygenMgL', 4.5, 6], ['dissolvedOxygenMgL', 2, 6], ['dissolvedOxygenMgL', 1.9, 10],
    ['biochemicalOxygenDemandMgL', 3, 1], ['biochemicalOxygenDemandMgL', 4.9, 3], ['biochemicalOxygenDemandMgL', 5, 6], ['biochemicalOxygenDemandMgL', 15, 6], ['biochemicalOxygenDemandMgL', 15.1, 10],
    ['suspendedSolidsMgL', 20, 1], ['suspendedSolidsMgL', 49.9, 3], ['suspendedSolidsMgL', 50, 6], ['suspendedSolidsMgL', 100, 6], ['suspendedSolidsMgL', 101, 10],
    ['ammoniaNitrogenMgL', 0.5, 1], ['ammoniaNitrogenMgL', 0.99, 3], ['ammoniaNitrogenMgL', 1, 6], ['ammoniaNitrogenMgL', 3, 6], ['ammoniaNitrogenMgL', 3.1, 10],
  ] as const;
  for (const [key, raw, expected] of goldens) assert.equal(officialRpiPoints(key, raw), expected);
  for (const [key, raw] of [['dissolvedOxygenMgL', 4.55], ['biochemicalOxygenDemandMgL', 4.95], ['suspendedSolidsMgL', 49.95], ['ammoniaNitrogenMgL', 0.995]] as const) assert.equal(officialRpiPoints(key, raw), undefined);
});
test('four exact values are potential inputs only; censored/missing fields never admit RPI', async () => {
  const { snapshot } = await built;
  assert.ok(snapshot.rpi.completeInputCount > 0); assert.equal(snapshot.rpi.available, false); assert.equal(snapshot.rpi.eligibleCount, 0);
  assert.ok(snapshot.rpi.blockers.some(reason => reason.includes('rounding')));
  assert.ok(snapshot.rows.every(row => !row.rpiEligible));
  assert.ok(snapshot.rows.filter(row => row.completeFourIndicators).every(row => RPI_KEYS.every(key => validPolicyValue(row.values[key], key))));
});
test('strict longitudinal comparisons stay gated; limited pairs have exact lineage and no censored values', async () => {
  const { snapshot } = await built;
  assert.equal(snapshot.totals.strictComparisonCount, 0); assert.ok(snapshot.totals.limitedComparisonCount > 0);
  assert.ok(snapshot.comparisons.filter(c => c.limitedEligible).every(c => c.pairs.length > 0 && c.exclusionReasons.includes('historical_location_unverified')));
  const rowMap = new Map(snapshot.rows.map(row => [row.id, row]));
  for (const c of snapshot.comparisons) for (const p of c.pairs) {
    assert.equal(rowMap.get(p.fromId)!.values[c.indicator].qualifier, 'measured');
    assert.equal(rowMap.get(p.toId)!.month, p.month);
  }
  const sample = snapshot.rows.filter(row => row.stationId === snapshot.stations[0].stationId);
  const duplicated = [...sample, { ...sample[0], id: `${sample[0].id}:duplicate` }];
  const comparisons = buildPolicyComparisons(duplicated, [snapshot.stations[0]], [2023, 2024]);
  assert.ok(comparisons.every(c => !c.pairs.some(pair => pair.fromId === sample[0].id)));
});
test('snapshot validation handles malformed/null input without throwing', async () => {
  for (const bad of [null, [], {}, { sources: [null] }, { schemaVersion: '1.0.0' }]) assert.equal(validatePolicySnapshot(bad), false);
  const { snapshot } = await built;
  const forged = structuredClone(snapshot); (forged.sources as unknown[])[0] = null;
  assert.equal(validatePolicySnapshot(forged), false);
  assert.equal(validatePolicySnapshot(snapshot), true);
});
test('snapshot validation rejects forged units, station, counts and comparison lineage', async () => {
  const { snapshot } = await built;
  const mutations: Array<(s: PolicySnapshot) => void> = [
    s => { s.rows[0].values.ammoniaNitrogenMgL.unit = 'μg/L'; },
    s => { s.rows[0].riverName = 'different river'; },
    s => { s.totals.observedRowCount += 1; },
    s => { s.comparisons[0].strictEligible = true; },
    s => { const c = s.comparisons.find(c => c.pairs.length)!; c.pairs[0].fromValue += 1; c.pairs[0].change -= 1; },
    s => { s.qualifierCounts.ph.measured += 1; },
    s => { s.analysis!.scenarios[0].selectedIds = []; },
    s => { s.rows[0].status = 'unparseable'; },
  ];
  for (const mutate of mutations) { const forged = structuredClone(snapshot); mutate(forged); assert.equal(validatePolicySnapshot(forged), false); }
});
test('immutable exact-byte hashes reproduce and reject changed bytes or hostile pointer paths', async () => {
  const first = await built, second = await buildRiverWaterPolicySnapshot(process.cwd(), false);
  assert.equal(first.bytes, second.bytes); assert.deepEqual(first.pointer, second.pointer);
  assert.equal(createHash('sha256').update(first.bytes).digest('hex'), first.pointer.sha256);
  assert.equal((await verifyPolicyBytes(first.pointer, Buffer.from(first.bytes))).totals.observedRowCount, 720);
  await assert.rejects(verifyPolicyBytes(first.pointer, Buffer.from(first.bytes.replace('720', '721'))), /hash mismatch/);
  for (const file of ['../snapshot.json', 'https://example.com/snapshot.json', '/snapshots/x.json']) assert.equal(validatePolicyPointer({ ...first.pointer, file }), false);
});
test('failed source rebuild preserves the last accepted snapshot pointer', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'river-policy-'));
  try {
    await cp('data/raw/river-water-policy', path.join(temporary, 'data/raw/river-water-policy'), { recursive: true });
    const output = path.join(temporary, 'public/data/river-water-policy'); await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'current.json'), 'previous accepted pointer');
    const manifestPath = path.join(temporary, 'data/raw/river-water-policy/source-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')); manifest.sources[0].sha256 = '0'.repeat(64);
    await writeFile(manifestPath, JSON.stringify(manifest));
    await assert.rejects(buildRiverWaterPolicySnapshot(temporary), /hash mismatch/);
    assert.equal(await readFile(path.join(output, 'current.json'), 'utf8'), 'previous accepted pointer');
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
