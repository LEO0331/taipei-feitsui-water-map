import test from 'node:test';
import assert from 'node:assert/strict';
import { addCtsiTrendFields, buildCarlsonTrophicStateIndexSummary, classifyCarlsonTrophicStateIndex, classifyTrophicStateIndicator, parseCarlsonTrophicStateIndex, parseRocYear } from '../src/utils/carlsonTrophicStateIndex';
import type { CarlsonTrophicStateIndexRecord } from '../src/types/carlsonTrophicStateIndex';

function record(year: number, ctsi: number, indicator: CarlsonTrophicStateIndexRecord['trophicStateIndicatorCategory']): CarlsonTrophicStateIndexRecord {
  return {
    id: String(year),
    module: 'carlson_trophic_state_index',
    rocYear: year - 1911,
    year,
    yearKey: String(year),
    periodDate: `${year}-01-01`,
    ctsiRaw: String(ctsi),
    ctsi,
    ctsiCategory: classifyCarlsonTrophicStateIndex(ctsi),
    trophicStateIndicatorRaw: indicator,
    trophicStateIndicatorCategory: indicator,
    trendDirection: 'unknown',
    isLatestYear: false,
    sourceRecordHash: String(year),
    source: '臺北翡翠水庫卡爾森優養指數',
    sourceAgency: '翡管局',
  };
}

test('CTSI ROC year parser converts annual ROC years', () => {
  assert.deepEqual(parseRocYear('114'), { raw: '114', rocYear: 114, year: 2025 });
  assert.equal(parseRocYear('abc').rocYear, undefined);
});

test('CTSI parser preserves decimals and warns on out-of-range values', () => {
  assert.equal(parseCarlsonTrophicStateIndex('37.61').value, 37.61);
  const parsed = parseCarlsonTrophicStateIndex('101');
  assert.equal(parsed.value, 101);
  assert.match(parsed.warning ?? '', /outside expected/);
});

test('CTSI category helpers classify source indicators and numeric bands', () => {
  assert.equal(classifyTrophicStateIndicator('貧養'), 'oligotrophic');
  assert.equal(classifyTrophicStateIndicator('普養'), 'mesotrophic');
  assert.equal(classifyCarlsonTrophicStateIndex(37.61), '30_to_40');
  assert.equal(classifyCarlsonTrophicStateIndex(41.22), '40_to_50');
});

test('CTSI trend and summary values are generated from records', () => {
  const records = addCtsiTrendFields([
    record(2023, 38, 'oligotrophic'),
    record(2024, 37, 'oligotrophic'),
    record(2025, 37.6, 'oligotrophic'),
  ]).map((item, index, list) => ({ ...item, isLatestYear: index === list.length - 1 }));
  assert.equal(records[0].trendDirection, 'first_record');
  assert.equal(records[1].trendDirection, 'decrease');
  assert.equal(records[2].trendDirection, 'increase');
  assert.equal(records[2].rolling3YearAverage, (38 + 37 + 37.6) / 3);
  const summary = buildCarlsonTrophicStateIndexSummary(records);
  assert.equal(summary.latestYear, 2025);
  assert.equal(summary.minCtsi?.value, 37);
  assert.equal(summary.maxCtsi?.value, 38);
  assert.equal(summary.trophicStateIndicatorCounts.oligotrophic, 3);
});
