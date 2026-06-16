import type { HydrometMonthlySummary } from '../types/hydromet';
import type {
  OperationDailyRecord,
  OperationMonthlySummary,
  OperationParameterKey,
  OperationParameterSeriesPoint,
  OperationValue,
} from '../types/operation';
import type { WaterQualityRecord } from '../types/waterQuality';

export const operationParameterKeys = [
  'dailyAverageWaterLevelM',
  'effectiveStorageMillionM3',
  'catchmentAverageRainfallMm',
  'reservoirInflowM3',
  'reservoirOutflowM3',
  'inflowMinusOutflowM3',
  'nanshiRiverFlowM3',
  'combinedRawWaterM3',
] as const satisfies OperationParameterKey[];

export const operationColumnMap: Record<OperationParameterKey, string[]> = {
  dailyAverageWaterLevelM: ['翡翠水庫日平均水位/公尺', '翡翠水庫日平均水位'],
  effectiveStorageMillionM3: ['水庫有效蓄水量/百萬立方公尺', '有效容量', '有效蓄水量'],
  catchmentAverageRainfallMm: ['集水區平均雨量/毫米', '集水區雨量', '集水區平均雨量'],
  reservoirInflowM3: ['水庫進流量/立方公尺', '進水量', '水庫進流量'],
  reservoirOutflowM3: ['水庫放流量/立方公尺', '放流量合計', '水庫放流量'],
  inflowMinusOutflowM3: ['進流量減放流量/立方公尺', '進流量減放流量'],
  nanshiRiverFlowM3: ['南勢溪流量/立方公尺', '南勢溪流量'],
  combinedRawWaterM3: ['南北勢溪合計原水量/立方公尺', '南北勢溪合計原水量'],
};

export function normalizeOperationColumnName(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replaceAll('／', '/').toLowerCase();
}

export function parseOperationValue(raw: unknown): OperationValue {
  if (raw === null || raw === undefined) return { raw: '', value: null, qualifier: 'missing' };
  const text = String(raw).trim();
  if (!text || text === '-') return { raw: text, value: null, qualifier: 'missing' };
  const value = Number(text.replaceAll(',', ''));
  return Number.isFinite(value)
    ? { raw: text, value, qualifier: 'measured' }
    : { raw: text, value: null, qualifier: 'missing' };
}

export function parseOperationDate(raw: string, fallbackPeriod?: string): string {
  const text = raw.trim();
  const full = text.match(/^(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})$/)
    ?? text.match(/^(\d{2,4})年(\d{1,2})月(\d{1,2})日?$/);
  if (full) {
    const rawYear = Number(full[1]);
    const year = rawYear < 1911 ? rawYear + 1911 : rawYear;
    return `${year}-${String(Number(full[2])).padStart(2, '0')}-${String(Number(full[3])).padStart(2, '0')}`;
  }

  const monthDay = text.match(/^(\d{1,2})月(\d{1,2})日?$/);
  if (monthDay && fallbackPeriod) {
    const [year] = fallbackPeriod.split('-');
    return `${year}-${String(Number(monthDay[1])).padStart(2, '0')}-${String(Number(monthDay[2])).padStart(2, '0')}`;
  }

  throw new Error(`Could not parse operation date: ${raw}`);
}

export function parsePeriodFromTitle(title: string): string | null {
  const match = title.match(/(\d{2,4})年(\d{1,2})月/);
  if (!match) return null;
  const rawYear = Number(match[1]);
  const year = rawYear < 1911 ? rawYear + 1911 : rawYear;
  return `${year}-${String(Number(match[2])).padStart(2, '0')}`;
}

function numeric(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

function average(values: Array<number | null>): number | null {
  const items = numeric(values);
  if (!items.length) return null;
  return items.reduce((sum, value) => sum + value, 0) / items.length;
}

function total(values: Array<number | null>): number | null {
  const items = numeric(values);
  if (!items.length) return null;
  return items.reduce((sum, value) => sum + value, 0);
}

function min(values: Array<number | null>): number | null {
  const items = numeric(values);
  return items.length ? Math.min(...items) : null;
}

function max(values: Array<number | null>): number | null {
  const items = numeric(values);
  return items.length ? Math.max(...items) : null;
}

export function aggregateOperationMonthlySummary(records: OperationDailyRecord[]): OperationMonthlySummary[] {
  const byPeriod = new Map<string, OperationDailyRecord[]>();
  for (const record of records) {
    if (!byPeriod.has(record.period)) byPeriod.set(record.period, []);
    byPeriod.get(record.period)!.push(record);
  }

  return [...byPeriod.entries()]
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, periodRecords]) => {
      const first = periodRecords[0];
      const waterLevels = periodRecords.map((record) => record.values.dailyAverageWaterLevelM.value);
      const storage = periodRecords.map((record) => record.values.effectiveStorageMillionM3.value);
      const rainfall = periodRecords.map((record) => record.values.catchmentAverageRainfallMm.value);
      return {
        period,
        year: first.year,
        month: first.month,
        dayCount: periodRecords.length,
        avgWaterLevelM: average(waterLevels),
        minWaterLevelM: min(waterLevels),
        maxWaterLevelM: max(waterLevels),
        avgEffectiveStorageMillionM3: average(storage),
        minEffectiveStorageMillionM3: min(storage),
        maxEffectiveStorageMillionM3: max(storage),
        totalCatchmentRainfallMm: total(rainfall),
        totalReservoirInflowM3: total(periodRecords.map((record) => record.values.reservoirInflowM3.value)),
        totalReservoirOutflowM3: total(periodRecords.map((record) => record.values.reservoirOutflowM3.value)),
        totalInflowMinusOutflowM3: total(periodRecords.map((record) => record.values.inflowMinusOutflowM3.value)),
        totalNanshiRiverFlowM3: total(periodRecords.map((record) => record.values.nanshiRiverFlowM3.value)),
        totalCombinedRawWaterM3: total(periodRecords.map((record) => record.values.combinedRawWaterM3.value)),
        highestDailyRainfallMm: max(rainfall),
        lowestWaterLevelM: min(waterLevels),
      };
    });
}

export function aggregateOperationParameterSeries(
  records: OperationDailyRecord[],
  parameter: OperationParameterKey,
): OperationParameterSeriesPoint[] {
  return records.map((record) => ({
    date: record.date,
    period: record.period,
    parameter,
    value: record.values[parameter].value,
  }));
}

export function joinMonitoringDataByPeriod(
  waterRecords: WaterQualityRecord[],
  hydrometSummaries: HydrometMonthlySummary[],
  operationSummaries: OperationMonthlySummary[],
) {
  const hydrometByPeriod = new Map(hydrometSummaries.map((summary) => [summary.period, summary]));
  const operationByPeriod = new Map(operationSummaries.map((summary) => [summary.period, summary]));
  const waterByPeriod = new Map<string, WaterQualityRecord[]>();
  for (const record of waterRecords) {
    if (!waterByPeriod.has(record.period)) waterByPeriod.set(record.period, []);
    waterByPeriod.get(record.period)!.push(record);
  }

  return [...waterByPeriod.entries()]
    .filter(([period]) => hydrometByPeriod.has(period) || operationByPeriod.has(period))
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, records]) => ({
      period,
      waterRecords: records,
      hydromet: hydrometByPeriod.get(period) ?? null,
      operation: operationByPeriod.get(period) ?? null,
    }));
}
