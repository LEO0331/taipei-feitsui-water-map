import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateOperationMonthlySummary,
  joinMonitoringDataByPeriod,
  parseOperationDate,
  parseOperationValue,
  parsePeriodFromTitle,
} from '../src/utils/operation';
import type { HydrometMonthlySummary } from '../src/types/hydromet';
import type { OperationDailyRecord } from '../src/types/operation';
import type { WaterQualityRecord } from '../src/types/waterQuality';

function makeOperationRecord(date: string, rainfall = 0): OperationDailyRecord {
  const [yearText, monthText, dayText] = date.split('-');
  const value = (raw: string, numeric: number) => ({ raw, value: numeric, qualifier: 'measured' as const });
  return {
    id: date,
    date,
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
    period: `${yearText}-${monthText}`,
    values: {
      dailyAverageWaterLevelM: value('165', 165),
      effectiveStorageMillionM3: value('320', 320),
      catchmentAverageRainfallMm: value(String(rainfall), rainfall),
      reservoirInflowM3: value('1,000', 1000),
      reservoirOutflowM3: value('800', 800),
      inflowMinusOutflowM3: value('200', 200),
      nanshiRiverFlowM3: value('500', 500),
      combinedRawWaterM3: value('1,300', 1300),
    },
    sourceResource: 'test',
  };
}

test('parseOperationValue preserves raw comma-formatted values', () => {
  assert.deepEqual(parseOperationValue('-'), { raw: '-', value: null, qualifier: 'missing' });
  assert.deepEqual(parseOperationValue('1,341,116'), { raw: '1,341,116', value: 1341116, qualifier: 'measured' });
});

test('parseOperationDate accepts ROC dates and resource-title fallback months', () => {
  assert.equal(parseOperationDate('115/4/5'), '2026-04-05');
  assert.equal(parseOperationDate('115年4月5日'), '2026-04-05');
  assert.equal(parseOperationDate('4月5日', '2026-04'), '2026-04-05');
  assert.equal(parsePeriodFromTitle('115年4月翡翠水庫運轉資料'), '2026-04');
});

test('aggregateOperationMonthlySummary totals flows and bounds water level', () => {
  const [summary] = aggregateOperationMonthlySummary([
    makeOperationRecord('2026-04-01', 1),
    makeOperationRecord('2026-04-02', 3),
  ]);

  assert.equal(summary.period, '2026-04');
  assert.equal(summary.dayCount, 2);
  assert.equal(summary.avgWaterLevelM, 165);
  assert.equal(summary.totalCatchmentRainfallMm, 4);
  assert.equal(summary.totalReservoirInflowM3, 2000);
  assert.equal(summary.totalReservoirOutflowM3, 1600);
  assert.equal(summary.highestDailyRainfallMm, 3);
});

test('joinMonitoringDataByPeriod joins water with hydromet or operation context', () => {
  const waterRecord = { period: '2026-04', values: {}, isSummaryRow: false } as WaterQualityRecord;
  const hydromet = { period: '2026-03' } as HydrometMonthlySummary;
  const [operation] = aggregateOperationMonthlySummary([makeOperationRecord('2026-04-01')]);

  const joined = joinMonitoringDataByPeriod([waterRecord], [hydromet], [operation]);
  assert.equal(joined.length, 1);
  assert.equal(joined[0].period, '2026-04');
  assert.equal(joined[0].operation?.period, '2026-04');
});
