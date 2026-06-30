import type { TaipeiWaterSupportTwcAnnualSummary, TaipeiWaterSupportTwcMonthlyRecord, TaipeiWaterSupportTwcSummary } from '../types/twcSupport';

const missing = new Set(['', '-', '--', 'nan', 'null']);
const sum = (values: Array<number | undefined>) => values.reduce<number>((total, value) => total + (value ?? 0), 0);
const pct = (part?: number, total?: number) => part === undefined || total === undefined || total === 0 ? undefined : (part / total) * 100;

export function cleanText(raw: unknown): string | undefined {
  const value = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(value.toLowerCase()) ? undefined : value;
}

export function parseWaterVolume(raw: unknown): number | undefined {
  const value = cleanText(raw)?.replace(/,/g, '');
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function percentChange(current: number | undefined, previous: number | undefined): number | undefined {
  return current === undefined || previous === undefined || previous === 0 ? undefined : ((current - previous) / previous) * 100;
}

export function parseSupportMonthDate(raw: unknown, fallbackRocYear?: number) {
  const dateRaw = cleanText(raw);
  if (!dateRaw) return { dateRaw };
  const zhMonthDay = dateRaw.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (zhMonthDay && fallbackRocYear) {
    const year = fallbackRocYear + 1911;
    const month = Number(zhMonthDay[1]);
    if (month < 1 || month > 12) return { dateRaw, warning: `Invalid month: ${dateRaw}` };
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    return { dateRaw, date: `${monthKey}-01`, year, month, monthKey, quarter: `${year}-Q${Math.ceil(month / 3)}`, rocYear: fallbackRocYear };
  }
  const compactRoc = dateRaw.match(/^(\d{3})(\d{2})(\d{2})$/);
  const parts = compactRoc
    ? [compactRoc[1], compactRoc[2]]
    : dateRaw.match(/^(\d{3,4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)?.slice(1, 3);
  if (!parts) return { dateRaw, warning: `Invalid support month date: ${dateRaw}` };
  const rawYear = Number(parts[0]);
  const month = Number(parts[1]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { dateRaw, warning: `Invalid month: ${dateRaw}` };
  const year = rawYear < 1911 ? rawYear + 1911 : rawYear;
  const rocYear = rawYear < 1911 ? rawYear : undefined;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return { dateRaw, date: `${monthKey}-01`, year, month, monthKey, quarter: `${year}-Q${Math.ceil(month / 3)}`, rocYear };
}

export function deriveSupportMetrics(records: TaipeiWaterSupportTwcMonthlyRecord[]) {
  const sorted = records.filter((record) => record.monthKey).sort((a, b) => a.monthKey!.localeCompare(b.monthKey!));
  const byMonth = new Map(sorted.map((record) => [record.monthKey, record]));
  const latest = sorted.at(-1)?.monthKey;
  return sorted.map((record, index) => {
    const previous = sorted[index - 1];
    const previousYear = record.year && record.month ? byMonth.get(`${record.year - 1}-${String(record.month).padStart(2, '0')}`) : undefined;
    const rolling = sorted.slice(Math.max(0, index - 11), index + 1).map((item) => item.totalSupportVolume);
    return {
      ...record,
      firstDistrictOfficeSharePercent: pct(record.firstDistrictOfficeSupportVolume, record.totalSupportVolume),
      twelfthDistrictOfficeSharePercent: pct(record.twelfthDistrictOfficeSupportVolume, record.totalSupportVolume),
      monthOverMonthTotalChange: previous?.totalSupportVolume === undefined || record.totalSupportVolume === undefined ? undefined : record.totalSupportVolume - previous.totalSupportVolume,
      monthOverMonthTotalChangePercent: percentChange(record.totalSupportVolume, previous?.totalSupportVolume),
      yearOverYearTotalChange: previousYear?.totalSupportVolume === undefined || record.totalSupportVolume === undefined ? undefined : record.totalSupportVolume - previousYear.totalSupportVolume,
      yearOverYearTotalChangePercent: percentChange(record.totalSupportVolume, previousYear?.totalSupportVolume),
      rolling12MonthTotalSupportVolume: rolling.length === 12 && rolling.every((value) => value !== undefined) ? sum(rolling) : undefined,
      isLatestMonth: record.monthKey === latest,
    };
  });
}

export function buildTaipeiWaterSupportTwcSummary(records: TaipeiWaterSupportTwcMonthlyRecord[]): TaipeiWaterSupportTwcSummary {
  const dated = records.filter((record) => record.monthKey).sort((a, b) => a.monthKey!.localeCompare(b.monthKey!));
  const total = sum(records.map((record) => record.totalSupportVolume));
  const first = sum(records.map((record) => record.firstDistrictOfficeSupportVolume));
  const twelfth = sum(records.map((record) => record.twelfthDistrictOfficeSupportVolume));
  const byYear: TaipeiWaterSupportTwcAnnualSummary[] = [...new Set(dated.map((record) => record.year).filter(Boolean) as number[])].map((year) => {
    const yearRecords = dated.filter((record) => record.year === year);
    const totals = yearRecords.filter((record) => record.totalSupportVolume !== undefined);
    const yearTotal = sum(yearRecords.map((record) => record.totalSupportVolume));
    const max = [...totals].sort((a, b) => (b.totalSupportVolume ?? 0) - (a.totalSupportVolume ?? 0))[0];
    const min = [...totals].sort((a, b) => (a.totalSupportVolume ?? 0) - (b.totalSupportVolume ?? 0))[0];
    return {
      year,
      recordCount: yearRecords.length,
      totalSupportVolume: yearTotal,
      firstDistrictOfficeSupportVolume: sum(yearRecords.map((record) => record.firstDistrictOfficeSupportVolume)),
      twelfthDistrictOfficeSupportVolume: sum(yearRecords.map((record) => record.twelfthDistrictOfficeSupportVolume)),
      firstDistrictOfficeSharePercent: pct(sum(yearRecords.map((record) => record.firstDistrictOfficeSupportVolume)), yearTotal),
      twelfthDistrictOfficeSharePercent: pct(sum(yearRecords.map((record) => record.twelfthDistrictOfficeSupportVolume)), yearTotal),
      monthlyAverageTotalSupportVolume: totals.length ? yearTotal / totals.length : undefined,
      maxMonthlyTotalSupportVolume: max?.totalSupportVolume,
      maxMonthlyTotalSupportVolumeMonth: max?.monthKey,
      minMonthlyTotalSupportVolume: min?.totalSupportVolume,
      minMonthlyTotalSupportVolumeMonth: min?.monthKey,
    };
  });
  const monthlyTotals = dated.filter((record) => record.totalSupportVolume !== undefined);
  const highest = [...monthlyTotals].sort((a, b) => (b.totalSupportVolume ?? 0) - (a.totalSupportVolume ?? 0))[0];
  const lowest = [...monthlyTotals].sort((a, b) => (a.totalSupportVolume ?? 0) - (b.totalSupportVolume ?? 0))[0];
  return {
    totalRecords: records.length,
    minDate: dated[0]?.date,
    maxDate: dated.at(-1)?.date,
    minYear: dated[0]?.year,
    maxYear: dated.at(-1)?.year,
    latestMonth: dated.at(-1)?.monthKey,
    supportVolumeUnit: 'raw',
    totalSupportVolume: total,
    totalFirstDistrictOfficeSupportVolume: first,
    totalTwelfthDistrictOfficeSupportVolume: twelfth,
    latestRecord: dated.at(-1),
    byYear,
    byMonth: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const items = dated.filter((record) => record.month === month);
      const monthTotal = sum(items.map((record) => record.totalSupportVolume));
      return { month, recordCount: items.length, totalSupportVolume: monthTotal, monthlyAverageTotalSupportVolume: items.length ? monthTotal / items.length : undefined };
    }),
    destinationBreakdown: [
      { destination: 'first_district_office', labelZh: '第一區處', labelEn: 'First District Office', totalSupportVolume: first, sharePercent: pct(first, total) },
      { destination: 'twelfth_district_office', labelZh: '第十二區處', labelEn: 'Twelfth District Office', totalSupportVolume: twelfth, sharePercent: pct(twelfth, total) },
    ],
    highestMonthlySupportVolume: highest?.monthKey ? { monthKey: highest.monthKey, totalSupportVolume: highest.totalSupportVolume } : undefined,
    lowestMonthlySupportVolume: lowest?.monthKey ? { monthKey: lowest.monthKey, totalSupportVolume: lowest.totalSupportVolume } : undefined,
  };
}
