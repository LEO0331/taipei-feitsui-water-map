import type { TapWaterBusinessKeyMetricRecord, TapWaterBusinessKeyMetricSummary } from '../types/tapWaterBusiness';

const missing = new Set(['', '-', '--', 'nan', 'null', '尚無資料']);
const changeKeys = ['distributedWaterVolumeM3', 'billedWaterVolumeM3', 'taiwanWaterSupportVolumeM3', 'waterUseExcludingTaiwanWaterSupportM3', 'directDrinkingFountainCount', 'averageWaterPressureKgCm2', 'transmissionDistributionPipelineLengthKm', 'userCount', 'perCapitaDailyWaterUseLiter', 'employeeCount', 'usersPerEmployee', 'monthlyRevenueThousandNtd', 'monthlyExpenseThousandNtd', 'monthlySurplusThousandNtd', 'assetsThousandNtd', 'liabilitiesThousandNtd', 'equityThousandNtd'] as const;
const rollingKeys = ['distributedWaterVolumeM3', 'billedWaterVolumeM3', 'taiwanWaterSupportVolumeM3', 'waterUseExcludingTaiwanWaterSupportM3', 'monthlyRevenueThousandNtd', 'monthlyExpenseThousandNtd', 'monthlySurplusThousandNtd'] as const;

export function cleanText(raw: unknown): string | undefined {
  const value = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(value.toLowerCase()) ? undefined : value;
}

export function parseMetricNumber(raw: unknown): { raw?: string; value?: number; warning?: string } {
  const rawText = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  const text = cleanText(rawText)?.replace(/^"|"$/g, '').replace(/,/g, '');
  if (!text) return { raw: rawText || undefined };
  const value = Number(text);
  return Number.isFinite(value) ? { raw: rawText, value } : { raw: rawText, warning: `Unparsed numeric value: ${rawText}` };
}

export function parseRocYearMonth(raw: unknown): {
  periodRaw?: string; rocYear?: number; year?: number; month?: number; monthKey?: string; periodDate?: string; quarter?: string; yearMonthLabel?: string; warning?: string;
} {
  const periodRaw = cleanText(raw);
  if (!periodRaw) return { warning: 'Missing period' };
  const compact = periodRaw.match(/^(\d{3})(\d{2})$/);
  const slash = periodRaw.match(/^(\d{2,3})\/(\d{1,2})$/);
  const zh = periodRaw.match(/民國?\s*(\d{2,3})年\s*(\d{1,2})月/);
  const match = compact ? [compact[1], compact[2]] : slash ? [slash[1], slash[2]] : zh ? [zh[1], zh[2]] : undefined;
  if (!match) return { periodRaw, warning: `Unparsed period: ${periodRaw}` };
  const rocYear = Number(match[0]);
  const month = Number(match[1]);
  if (!Number.isInteger(rocYear) || !Number.isInteger(month) || month < 1 || month > 12) return { periodRaw, warning: `Invalid period: ${periodRaw}` };
  const year = rocYear + 1911;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return { periodRaw, rocYear, year, month, monthKey, periodDate: `${monthKey}-01`, quarter: `${year}-Q${Math.ceil(month / 3)}`, yearMonthLabel: monthKey };
}

const ratio = (num?: number, den?: number) => num !== undefined && den ? (num / den) * 100 : undefined;
const million = (value?: number) => value === undefined ? undefined : value / 1_000_000;
const sumIfAll = (...values: Array<number | undefined>) => values.every((value) => value !== undefined) ? values.reduce((sum, value) => sum + value!, 0) : undefined;

export function deriveTapWaterBusinessMetrics(record: TapWaterBusinessKeyMetricRecord): TapWaterBusinessKeyMetricRecord {
  const operatingRevenueThousandNtd = sumIfAll(record.salesRevenueThousandNtd, record.serviceRevenueThousandNtd, record.otherOperatingRevenueThousandNtd);
  const operatingExpenseThousandNtd = sumIfAll(record.salesCostThousandNtd, record.serviceCostThousandNtd, record.otherOperatingCostThousandNtd);
  const nonRevenueOrUnbilledWaterApproxM3 = record.distributedWaterVolumeM3 !== undefined && record.billedWaterVolumeM3 !== undefined ? record.distributedWaterVolumeM3 - record.billedWaterVolumeM3 : undefined;
  return {
    ...record,
    distributedWaterVolumeMillionM3: million(record.distributedWaterVolumeM3),
    billedWaterVolumeMillionM3: million(record.billedWaterVolumeM3),
    taiwanWaterSupportVolumeMillionM3: million(record.taiwanWaterSupportVolumeM3),
    waterUseExcludingSupportMillionM3: million(record.waterUseExcludingTaiwanWaterSupportM3),
    supportShareOfDistributedWaterPercent: ratio(record.taiwanWaterSupportVolumeM3, record.distributedWaterVolumeM3),
    billedShareOfDistributedWaterPercent: ratio(record.billedWaterVolumeM3, record.distributedWaterVolumeM3),
    nonRevenueOrUnbilledWaterApproxM3,
    nonRevenueOrUnbilledWaterApproxPercent: ratio(nonRevenueOrUnbilledWaterApproxM3, record.distributedWaterVolumeM3),
    populationServedSharePercent: ratio(record.supplyAreaServedPopulation, record.supplyAreaTotalPopulation),
    usersPerThousandPopulation: record.userCount !== undefined && record.supplyAreaTotalPopulation ? record.userCount / record.supplyAreaTotalPopulation * 1000 : undefined,
    monthlyRevenueMillionNtd: record.monthlyRevenueThousandNtd === undefined ? undefined : record.monthlyRevenueThousandNtd / 1000,
    monthlyExpenseMillionNtd: record.monthlyExpenseThousandNtd === undefined ? undefined : record.monthlyExpenseThousandNtd / 1000,
    monthlySurplusMillionNtd: record.monthlySurplusThousandNtd === undefined ? undefined : record.monthlySurplusThousandNtd / 1000,
    operatingRevenueThousandNtd,
    operatingExpenseThousandNtd,
    operatingMarginApproxPercent: ratio(record.monthlySurplusThousandNtd, record.monthlyRevenueThousandNtd),
    debtRatioPercent: ratio(record.liabilitiesThousandNtd, record.assetsThousandNtd),
    equityRatioPercent: ratio(record.equityThousandNtd, record.assetsThousandNtd),
  };
}

function change(current?: number, previous?: number) {
  if (current === undefined || previous === undefined) return {};
  return { change: current - previous, percentChange: previous === 0 ? undefined : ((current - previous) / previous) * 100 };
}

export function addMonthOverMonthAndYearOverYearChanges(records: TapWaterBusinessKeyMetricRecord[]): TapWaterBusinessKeyMetricRecord[] {
  const sorted = [...records].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const byMonth = new Map(sorted.map((record) => [record.monthKey, record]));
  return sorted.map((record, index) => {
    const previous = sorted[index - 1];
    const yoy = byMonth.get(`${record.year - 1}-${String(record.month).padStart(2, '0')}`);
    return {
      ...record,
      monthOverMonthChanges: Object.fromEntries(changeKeys.map((key) => [key, change(record[key], previous?.[key])])),
      yearOverYearChanges: Object.fromEntries(changeKeys.map((key) => [key, change(record[key], yoy?.[key])])),
    };
  });
}

export function addRolling12MonthSums(records: TapWaterBusinessKeyMetricRecord[]): TapWaterBusinessKeyMetricRecord[] {
  const sorted = [...records].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return sorted.map((record, index) => {
    const window = sorted.slice(index - 11, index + 1);
    if (window.length !== 12) return record;
    const expectedStart = new Date(record.year, record.month - 12, 1);
    if (window[0].monthKey !== `${expectedStart.getFullYear()}-${String(expectedStart.getMonth() + 1).padStart(2, '0')}`) return record;
    return { ...record, rolling12MonthSums: Object.fromEntries(rollingKeys.map((key) => [key, window.every((item) => item[key] !== undefined) ? window.reduce((sum, item) => sum + item[key]!, 0) : undefined])) };
  });
}

const average = (values: Array<number | undefined>) => {
  const nums = values.filter((value): value is number => value !== undefined);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : undefined;
};
const sum = (values: Array<number | undefined>) => values.every((value) => value !== undefined) ? values.reduce((total, value) => total + value!, 0) : undefined;
const extreme = (records: TapWaterBusinessKeyMetricRecord[], key: keyof TapWaterBusinessKeyMetricRecord, direction: 'max' | 'min') => {
  const items = records
    .map((record) => ({ monthKey: record.monthKey, value: record[key] }))
    .filter((item): item is { monthKey: string; value: number } => typeof item.value === 'number');
  return items.sort((a, b) => direction === 'max' ? b.value - a.value : a.value - b.value)[0];
};

export function buildTapWaterBusinessKeyMetricSummary(records: TapWaterBusinessKeyMetricRecord[], dataQuality = { invalidPeriodCount: 0, missingMetricValueCount: 0, invalidNumericValueCount: 0, duplicateMonthKeyCount: 0 }): TapWaterBusinessKeyMetricSummary {
  const sorted = [...records].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  const latest = sorted.at(-1);
  const years = [...new Set(sorted.map((record) => record.year))].sort();
  return {
    totalRecords: sorted.length,
    minMonthKey: sorted[0]?.monthKey,
    maxMonthKey: latest?.monthKey,
    latestMonthKey: latest?.monthKey,
    latest,
    byYear: years.map((year) => {
      const items = sorted.filter((record) => record.year === year);
      return {
        year,
        monthCount: items.length,
        distributedWaterVolumeM3Sum: sum(items.map((record) => record.distributedWaterVolumeM3)),
        billedWaterVolumeM3Sum: sum(items.map((record) => record.billedWaterVolumeM3)),
        taiwanWaterSupportVolumeM3Sum: sum(items.map((record) => record.taiwanWaterSupportVolumeM3)),
        waterUseExcludingTaiwanWaterSupportM3Sum: sum(items.map((record) => record.waterUseExcludingTaiwanWaterSupportM3)),
        monthlyRevenueThousandNtdSum: sum(items.map((record) => record.monthlyRevenueThousandNtd)),
        monthlyExpenseThousandNtdSum: sum(items.map((record) => record.monthlyExpenseThousandNtd)),
        monthlySurplusThousandNtdSum: sum(items.map((record) => record.monthlySurplusThousandNtd)),
        averagePerCapitaDailyWaterUseLiter: average(items.map((record) => record.perCapitaDailyWaterUseLiter)),
        averageSupplyCoverageRatePercent: average(items.map((record) => record.supplyCoverageRatePercent)),
      };
    }),
    rolling12MonthLatest: latest?.rolling12MonthSums ? { monthKey: latest.monthKey, ...latest.rolling12MonthSums } : undefined,
    metricExtremes: {
      maxDistributedWaterVolume: extreme(sorted, 'distributedWaterVolumeM3', 'max'),
      minDistributedWaterVolume: extreme(sorted, 'distributedWaterVolumeM3', 'min'),
      maxPerCapitaDailyWaterUse: extreme(sorted, 'perCapitaDailyWaterUseLiter', 'max'),
      minPerCapitaDailyWaterUse: extreme(sorted, 'perCapitaDailyWaterUseLiter', 'min'),
      maxMonthlySurplus: extreme(sorted, 'monthlySurplusThousandNtd', 'max'),
      minMonthlySurplus: extreme(sorted, 'monthlySurplusThousandNtd', 'min'),
    },
    dataQuality,
  };
}
