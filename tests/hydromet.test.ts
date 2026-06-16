import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateHydrometMonthlySummary,
  getDominantWindDirection,
  joinWaterQualityAndHydrometByPeriod,
  parseHydrometDate,
  parseHydrometValue,
} from '../src/utils/hydromet';
import type { HydrometDailyRecord } from '../src/types/hydromet';
import type { WaterQualityRecord } from '../src/types/waterQuality';

function makeHydrometRecord(date: string, windDirection: string | null = '東北'): HydrometDailyRecord {
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
    windDirection,
    values: {
      windSpeedMS: value('2', 2),
      airPressureMb: value('1000', 1000),
      solarRadiationCalCm2: value('10', 10),
      evaporationMm: value('1.5', 1.5),
      relativeHumidityPercent: value('80', 80),
      maxTemperatureC: value('25', 25),
      minTemperatureC: value('18', 18),
      avgTemperatureC: value('21', 21),
    },
    sourceResource: 'test',
  };
}

test('parseHydrometDate accepts ROC and Gregorian slash dates', () => {
  assert.equal(parseHydrometDate('115/3/5'), '2026-03-05');
  assert.equal(parseHydrometDate('2026/03/05'), '2026-03-05');
  assert.equal(parseHydrometDate('115年3月5日'), '2026-03-05');
});

test('parseHydrometValue preserves raw missing and numeric values', () => {
  assert.deepEqual(parseHydrometValue('-'), { raw: '-', value: null, qualifier: 'missing' });
  assert.deepEqual(parseHydrometValue(''), { raw: '', value: null, qualifier: 'missing' });
  assert.deepEqual(parseHydrometValue('1,234.5'), { raw: '1,234.5', value: 1234.5, qualifier: 'measured' });
});

test('aggregateHydrometMonthlySummary totals and averages daily records', () => {
  const records = [
    makeHydrometRecord('2026-03-01', '東北'),
    makeHydrometRecord('2026-03-02', '東北'),
    makeHydrometRecord('2026-03-03', '西南'),
  ];
  const [summary] = aggregateHydrometMonthlySummary(records);

  assert.equal(summary.period, '2026-03');
  assert.equal(summary.dayCount, 3);
  assert.equal(summary.avgTemperatureC, 21);
  assert.equal(summary.totalEvaporationMm, 4.5);
  assert.equal(summary.totalSolarRadiationCalCm2, 30);
  assert.equal(summary.dominantWindDirection, '東北');
});

test('getDominantWindDirection returns null when all directions are missing', () => {
  assert.equal(getDominantWindDirection([makeHydrometRecord('2026-03-01', null)]), null);
});

test('joinWaterQualityAndHydrometByPeriod returns only shared periods', () => {
  const waterRecord = {
    period: '2026-03',
    values: {},
    isSummaryRow: false,
  } as WaterQualityRecord;
  const [hydromet] = aggregateHydrometMonthlySummary([makeHydrometRecord('2026-03-01')]);

  assert.equal(joinWaterQualityAndHydrometByPeriod([waterRecord], [hydromet]).length, 1);
  assert.equal(joinWaterQualityAndHydrometByPeriod([{ ...waterRecord, period: '2026-04' }], [hydromet]).length, 0);
});
