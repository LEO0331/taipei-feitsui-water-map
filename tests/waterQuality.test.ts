import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateStationComparison,
  buildWaterQualitySummary,
  filterRecords,
  parseRocYearMonthFromFilename,
  parseWaterQualityValue,
} from '../src/utils/waterQuality';
import type { Filters, WaterQualityRecord } from '../src/types/waterQuality';

function makeRecord(
  stationName: string,
  period: string,
  overrides: Partial<WaterQualityRecord> = {},
): WaterQualityRecord {
  const [yearText, monthText] = period.split('-');
  const baseValue = { raw: '1', value: 1, qualifier: 'measured' as const };
  const values = {
    waterLevelM: baseValue,
    airTemperatureC: baseValue,
    waterDepthM: baseValue,
    transparencyM: baseValue,
    waterTemperatureC: baseValue,
    turbidityNTU: baseValue,
    pH: { raw: '7.4', value: 7.4, qualifier: 'measured' as const },
    ammoniaNitrogenMgL: { raw: 'ND', value: null, qualifier: 'not_detected' as const },
    dissolvedOxygenMgL: { raw: '8.5', value: 8.5, qualifier: 'measured' as const },
    bodMgL: baseValue,
    codMgL: baseValue,
    suspendedSolidsMgL: baseValue,
    conductivityUsCm: baseValue,
    manganeseMgL: baseValue,
    coliformCfu100mL: baseValue,
    totalOrganicCarbonMgL: baseValue,
    totalPhosphorusUgL: { raw: '10', value: 10, qualifier: 'measured' as const },
    chlorophyllAUgL: baseValue,
    algaeCellsPerML: { raw: '100', value: 100, qualifier: 'measured' as const },
  };

  return {
    id: `${period}-${stationName}`,
    year: Number(yearText),
    rocYear: Number(yearText) - 1911,
    month: Number(monthText),
    period,
    stationName,
    stationGroup: 'reservoir_surface',
    isSummaryRow: false,
    sourceFileOrResource: 'test',
    values,
    ...overrides,
  };
}

test('parseWaterQualityValue preserves qualifiers and numeric thresholds', () => {
  assert.deepEqual(parseWaterQualityValue('ND'), {
    raw: 'ND',
    value: null,
    qualifier: 'not_detected',
  });
  assert.deepEqual(parseWaterQualityValue('<10'), {
    raw: '<10',
    value: 10,
    qualifier: 'less_than',
  });
  assert.deepEqual(parseWaterQualityValue('-'), {
    raw: '-',
    value: null,
    qualifier: 'missing',
  });
  assert.deepEqual(parseWaterQualityValue('1,234.5'), {
    raw: '1,234.5',
    value: 1234.5,
    qualifier: 'measured',
  });
});

test('parseRocYearMonthFromFilename converts ROC dates', () => {
  assert.deepEqual(parseRocYearMonthFromFilename('115年3月翡翠水庫水質月報表.csv'), {
    year: 2026,
    rocYear: 115,
    month: 3,
    period: '2026-03',
  });
});

test('filterRecords matches Chinese group and parameter labels', () => {
  const records = [
    makeRecord('火燒樟', '2026-03'),
    makeRecord('永安', '2026-03', { stationGroup: 'tributary_or_stream' }),
  ];
  const filters: Filters = {
    period: '2026-03',
    stationGroup: 'all',
    stationName: 'all',
    parameter: 'turbidityNTU',
    search: '水庫表水',
  };

  assert.deepEqual(filterRecords(records, filters).map((record) => record.stationName), ['火燒樟']);
  assert.equal(filterRecords(records, { ...filters, search: '濁度' }).length, 2);
});

test('buildWaterQualitySummary excludes summary rows from latest station count', () => {
  const summaryRow = makeRecord('表水平均值', '2026-03', {
    stationGroup: 'summary',
    isSummaryRow: true,
  });
  const summary = buildWaterQualitySummary([
    makeRecord('火燒樟', '2026-03'),
    makeRecord('小格頭', '2026-03'),
    summaryRow,
  ]);

  assert.equal(summary.latestPeriod, '2026-03');
  assert.equal(summary.latestStationCount, 2);
  assert.equal(summary.summaryCards.surfaceAveragePH, '7.4');
});

test('aggregateStationComparison excludes summary rows', () => {
  const comparison = aggregateStationComparison([
    makeRecord('火燒樟', '2026-03'),
    makeRecord('表水平均值', '2026-03', {
      stationGroup: 'summary',
      isSummaryRow: true,
    }),
  ], '2026-03', 'turbidityNTU');

  assert.deepEqual(comparison.map((point) => point.stationName), ['火燒樟']);
});
