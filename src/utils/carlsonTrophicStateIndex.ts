import type { CarlsonTrophicStateIndexCategory, CarlsonTrophicStateIndexRecord, CarlsonTrophicStateIndexSummary, TrophicStateIndicatorCategory, WaterQualityTrendDirection } from '../types/carlsonTrophicStateIndex';

const missing = new Set(['', '-', '--', 'nan', 'null', '尚無資料']);

export function cleanText(raw: unknown): string | undefined {
  const value = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(value.toLowerCase()) ? undefined : value;
}

export function parseRocYear(raw: unknown): { raw?: string; rocYear?: number; year?: number; warning?: string } {
  const text = cleanText(raw);
  if (!text) return { warning: 'Missing ROC year' };
  const match = text.match(/(\d{2,3})/);
  if (!match) return { raw: text, warning: `Unparsed ROC year: ${text}` };
  const rocYear = Number(match[1]);
  if (!Number.isInteger(rocYear) || rocYear < 1 || rocYear > 200) return { raw: text, warning: `Invalid ROC year: ${text}` };
  return { raw: text, rocYear, year: rocYear + 1911 };
}

export function parseCarlsonTrophicStateIndex(raw: unknown): { raw?: string; value?: number; warning?: string } {
  const rawText = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  const text = cleanText(rawText)?.replace(/,/g, '');
  if (!text) return { raw: rawText || undefined, warning: 'Missing CTSI value' };
  const value = Number(text);
  if (!Number.isFinite(value)) return { raw: rawText, warning: `Unparsed CTSI value: ${rawText}` };
  if (value < 0 || value > 100) return { raw: rawText, value, warning: `CTSI value outside expected 0-100 range: ${rawText}` };
  return { raw: rawText, value };
}

export function classifyTrophicStateIndicator(raw: unknown): TrophicStateIndicatorCategory {
  const text = cleanText(raw)?.toLowerCase();
  if (!text) return 'unknown';
  if (text.includes('貧') || text.includes('oligo')) return 'oligotrophic';
  if (text.includes('普') || text.includes('meso')) return 'mesotrophic';
  if (text.includes('優') || text.includes('eu')) return 'eutrophic';
  if (text.includes('超') || text.includes('hyper')) return 'hypereutrophic';
  return 'unknown';
}

export function parseTrophicStateIndicator(raw: unknown): { raw?: string; category: TrophicStateIndicatorCategory; warning?: string } {
  const text = cleanText(raw);
  const category = classifyTrophicStateIndicator(text);
  return { raw: text, category, warning: text && category === 'unknown' ? `Unknown trophic indicator: ${text}` : undefined };
}

export function classifyCarlsonTrophicStateIndex(value?: number): CarlsonTrophicStateIndexCategory {
  if (value === undefined) return 'missing';
  if (!Number.isFinite(value)) return 'unknown';
  if (value < 30) return 'under_30';
  if (value < 40) return '30_to_40';
  if (value < 50) return '40_to_50';
  if (value < 60) return '50_to_60';
  if (value < 70) return '60_to_70';
  return 'over_70';
}

export function classifyYearOverYearTrend(change?: number): WaterQualityTrendDirection {
  if (change === undefined) return 'first_record';
  if (Math.abs(change) < 0.005) return 'no_change';
  return change > 0 ? 'increase' : 'decrease';
}

export function addCtsiTrendFields(records: CarlsonTrophicStateIndexRecord[]): CarlsonTrophicStateIndexRecord[] {
  const sorted = [...records].sort((a, b) => a.year - b.year);
  return sorted.map((record, index) => {
    const previous = sorted[index - 1];
    const yearOverYearChange = record.ctsi !== undefined && previous?.ctsi !== undefined ? record.ctsi - previous.ctsi : undefined;
    const window = sorted.slice(Math.max(0, index - 2), index + 1).map((item) => item.ctsi).filter((value): value is number => value !== undefined);
    return {
      ...record,
      yearOverYearChange,
      yearOverYearPercentChange: yearOverYearChange !== undefined && previous?.ctsi ? yearOverYearChange / previous.ctsi * 100 : undefined,
      trendDirection: classifyYearOverYearTrend(yearOverYearChange),
      rolling3YearAverage: window.length === 3 ? average(window) : undefined,
    };
  });
}

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function median(values: number[]) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function countBy<T extends string>(keys: readonly T[], records: CarlsonTrophicStateIndexRecord[], getter: (record: CarlsonTrophicStateIndexRecord) => T): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, records.filter((record) => getter(record) === key).length])) as Record<T, number>;
}

const trophicKeys: readonly TrophicStateIndicatorCategory[] = ['oligotrophic', 'mesotrophic', 'eutrophic', 'hypereutrophic', 'unknown'];
const ctsiKeys: readonly CarlsonTrophicStateIndexCategory[] = ['under_30', '30_to_40', '40_to_50', '50_to_60', '60_to_70', 'over_70', 'missing', 'unknown'];
const trendKeys: readonly WaterQualityTrendDirection[] = ['increase', 'decrease', 'no_change', 'first_record', 'unknown'];

export function buildCarlsonTrophicStateIndexSummary(records: CarlsonTrophicStateIndexRecord[], dataQuality = { invalidYearCount: 0, missingCtsiCount: 0, invalidCtsiCount: 0, duplicateYearCount: 0, unknownIndicatorCount: 0 }): CarlsonTrophicStateIndexSummary {
  const sorted = [...records].sort((a, b) => a.year - b.year);
  const latest = sorted.at(-1);
  const numeric = sorted.filter((record): record is CarlsonTrophicStateIndexRecord & { ctsi: number } => record.ctsi !== undefined);
  const values = numeric.map((record) => record.ctsi);
  const firstNumeric = numeric[0];
  const latestNumeric = numeric.at(-1);
  const min = [...numeric].sort((a, b) => a.ctsi - b.ctsi)[0];
  const max = [...numeric].sort((a, b) => b.ctsi - a.ctsi)[0];
  const totalCtsiChange = firstNumeric && latestNumeric ? latestNumeric.ctsi - firstNumeric.ctsi : undefined;
  return {
    totalRecords: sorted.length,
    minYear: sorted[0]?.year,
    maxYear: latest?.year,
    minRocYear: sorted[0]?.rocYear,
    maxRocYear: latest?.rocYear,
    latestYear: latest?.year,
    latest,
    minCtsi: min ? { year: min.year, rocYear: min.rocYear, value: min.ctsi } : undefined,
    maxCtsi: max ? { year: max.year, rocYear: max.rocYear, value: max.ctsi } : undefined,
    averageCtsi: values.length ? average(values) : undefined,
    medianCtsi: median(values),
    totalCtsiChange,
    averageAnnualCtsiChange: totalCtsiChange !== undefined && firstNumeric && latestNumeric && latestNumeric.year > firstNumeric.year ? totalCtsiChange / (latestNumeric.year - firstNumeric.year) : undefined,
    trophicStateIndicatorCounts: countBy(trophicKeys, sorted, (record) => record.trophicStateIndicatorCategory),
    ctsiCategoryCounts: countBy(ctsiKeys, sorted, (record) => record.ctsiCategory),
    trendDirectionCounts: countBy(trendKeys, sorted, (record) => record.trendDirection),
    byYear: sorted.map((record) => ({
      year: record.year,
      rocYear: record.rocYear,
      ctsi: record.ctsi,
      trophicStateIndicatorCategory: record.trophicStateIndicatorCategory,
      trendDirection: record.trendDirection,
      yearOverYearChange: record.yearOverYearChange,
      rolling3YearAverage: record.rolling3YearAverage,
    })),
    dataQuality,
  };
}
