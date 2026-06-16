import type {
  HydrometDailyRecord,
  HydrometMonthlySummary,
  HydrometParameterKey,
  HydrometParameterSeriesPoint,
  HydrometValue,
} from '../types/hydromet';
import type { WaterQualityRecord, WaterQualityParameterKey } from '../types/waterQuality';

export const hydrometParameterKeys = [
  'windSpeedMS',
  'windDirection',
  'airPressureMb',
  'solarRadiationCalCm2',
  'evaporationMm',
  'relativeHumidityPercent',
  'maxTemperatureC',
  'minTemperatureC',
  'avgTemperatureC',
] as const satisfies HydrometParameterKey[];

export const hydrometColumnMap: Record<Exclude<HydrometParameterKey, 'windDirection'>, string[]> = {
  windSpeedMS: ['風速m/s', '風速'],
  airPressureMb: ['氣壓mb', '氣壓'],
  solarRadiationCalCm2: ['日輻射量cal/cm2', '日輻射量'],
  evaporationMm: ['蒸發量mm', '蒸發量'],
  relativeHumidityPercent: ['相對溼度％', '相對濕度％', '相對溼度%', '相對濕度%'],
  maxTemperatureC: ['最高溫度'],
  minTemperatureC: ['最低溫度'],
  avgTemperatureC: ['平均溫度'],
};

export function normalizeHydrometColumnName(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replaceAll('％', '%').toLowerCase();
}

export function parseHydrometValue(raw: unknown): HydrometValue {
  if (raw === null || raw === undefined) return { raw: '', value: null, qualifier: 'missing' };
  const text = String(raw).trim();
  if (!text || text === '-') return { raw: text, value: null, qualifier: 'missing' };
  const value = Number(text.replaceAll(',', ''));
  return Number.isFinite(value)
    ? { raw: text, value, qualifier: 'measured' }
    : { raw: text, value: null, qualifier: 'missing' };
}

export function parseHydrometDate(raw: string): string {
  const text = raw.trim();
  const parts = text.match(/^(\d{2,4})[/-](\d{1,2})[/-](\d{1,2})$/)
    ?? text.match(/^(\d{2,4})年(\d{1,2})月(\d{1,2})日?$/);
  if (!parts) throw new Error(`Could not parse hydromet date: ${raw}`);
  const rawYear = Number(parts[1]);
  const year = rawYear < 1911 ? rawYear + 1911 : rawYear;
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function total(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0);
}

export function getDominantWindDirection(records: HydrometDailyRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.windDirection) continue;
    counts.set(record.windDirection, (counts.get(record.windDirection) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant'))[0]?.[0] ?? null;
}

export function aggregateHydrometMonthlySummary(records: HydrometDailyRecord[]): HydrometMonthlySummary[] {
  const byPeriod = new Map<string, HydrometDailyRecord[]>();
  for (const record of records) {
    if (!byPeriod.has(record.period)) byPeriod.set(record.period, []);
    byPeriod.get(record.period)!.push(record);
  }

  return [...byPeriod.entries()]
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, periodRecords]) => {
      const first = periodRecords[0];
      return {
        period,
        year: first.year,
        month: first.month,
        dayCount: periodRecords.length,
        avgWindSpeedMS: average(periodRecords.map((record) => record.values.windSpeedMS.value)),
        dominantWindDirection: getDominantWindDirection(periodRecords),
        avgAirPressureMb: average(periodRecords.map((record) => record.values.airPressureMb.value)),
        totalSolarRadiationCalCm2: total(periodRecords.map((record) => record.values.solarRadiationCalCm2.value)),
        totalEvaporationMm: total(periodRecords.map((record) => record.values.evaporationMm.value)),
        avgRelativeHumidityPercent: average(periodRecords.map((record) => record.values.relativeHumidityPercent.value)),
        avgMaxTemperatureC: average(periodRecords.map((record) => record.values.maxTemperatureC.value)),
        avgMinTemperatureC: average(periodRecords.map((record) => record.values.minTemperatureC.value)),
        avgTemperatureC: average(periodRecords.map((record) => record.values.avgTemperatureC.value)),
      };
    });
}

export function aggregateHydrometParameterSeries(
  records: HydrometDailyRecord[],
  parameter: HydrometParameterKey,
): HydrometParameterSeriesPoint[] {
  if (parameter === 'windDirection') {
    return records.map((record) => ({ date: record.date, period: record.period, parameter, value: null }));
  }
  return records.map((record) => ({
    date: record.date,
    period: record.period,
    parameter,
    value: record.values[parameter].value,
  }));
}

export function joinWaterQualityAndHydrometByPeriod(
  waterRecords: WaterQualityRecord[],
  hydrometSummaries: HydrometMonthlySummary[],
) {
  const hydrometByPeriod = new Map(hydrometSummaries.map((summary) => [summary.period, summary]));
  const periodMap = new Map<string, WaterQualityRecord[]>();
  for (const record of waterRecords) {
    if (!periodMap.has(record.period)) periodMap.set(record.period, []);
    periodMap.get(record.period)!.push(record);
  }
  return [...periodMap.entries()]
    .filter(([period]) => hydrometByPeriod.has(period))
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, records]) => ({
      period,
      waterRecords: records,
      hydromet: hydrometByPeriod.get(period)!,
    }));
}

export function averageWaterQualityParameter(
  records: WaterQualityRecord[],
  parameter: WaterQualityParameterKey,
): number | null {
  return average(records.filter((record) => !record.isSummaryRow).map((record) => record.values[parameter].value));
}
