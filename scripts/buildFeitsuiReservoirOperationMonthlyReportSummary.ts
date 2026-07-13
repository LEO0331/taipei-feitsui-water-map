import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { OperationDailyRecord, OperationMonthlySummary, OperationYearlySummary } from '../src/types/operation';

const root = process.cwd();
const publicDataDir = path.join(root, 'public/data');
const outputDir = path.join(publicDataDir, 'feitsui-reservoir-operation-monthly-reports');

function numeric(values: Array<number | null | undefined>) {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function average(values: Array<number | null | undefined>) {
  const items = numeric(values);
  return items.length ? items.reduce((sum, value) => sum + value, 0) / items.length : null;
}

function total(values: Array<number | null | undefined>) {
  const items = numeric(values);
  return items.length ? items.reduce((sum, value) => sum + value, 0) : null;
}

export function buildOperationYearlySummary(monthly: OperationMonthlySummary[]): OperationYearlySummary[] {
  const byYear = new Map<number, OperationMonthlySummary[]>();
  for (const item of monthly) {
    const entries = byYear.get(item.year) ?? [];
    entries.push(item);
    byYear.set(item.year, entries);
  }
  return [...byYear.entries()].sort(([a], [b]) => a - b).map(([year, entries]) => ({
    year,
    monthCount: entries.length,
    dayCount: entries.reduce((sum, item) => sum + item.dayCount, 0),
    avgWaterLevelM: average(entries.map((item) => item.avgWaterLevelM)),
    avgEffectiveStorageMillionM3: average(entries.map((item) => item.avgEffectiveStorageMillionM3)),
    totalCatchmentRainfallMm: total(entries.map((item) => item.totalCatchmentRainfallMm)),
    totalReservoirInflowM3: total(entries.map((item) => item.totalReservoirInflowM3)),
    totalReservoirOutflowM3: total(entries.map((item) => item.totalReservoirOutflowM3)),
    totalInflowMinusOutflowM3: total(entries.map((item) => item.totalInflowMinusOutflowM3)),
  }));
}

async function main() {
  const [recordsText, monthlyText] = await Promise.all([
    readFile(path.join(publicDataDir, 'operation-daily-records.json'), 'utf8'),
    readFile(path.join(publicDataDir, 'operation-monthly-summary.json'), 'utf8'),
  ]);
  const records = JSON.parse(recordsText) as OperationDailyRecord[];
  const monthly = JSON.parse(monthlyText) as OperationMonthlySummary[];
  const yearly = buildOperationYearlySummary(monthly);
  const summary = {
    moduleKey: 'feitsui_reservoir_operation_monthly_reports',
    recordCount: records.length,
    dateRange: records.length ? { start: records[0].date, end: records.at(-1)?.date } : null,
    latestAvailableDate: records.at(-1)?.date ?? null,
    monthCount: monthly.length,
    yearCount: yearly.length,
  };
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, 'records.json'), `${JSON.stringify(records, null, 2)}\n`),
    writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`),
    writeFile(path.join(outputDir, 'monthly-summary.json'), `${JSON.stringify(monthly, null, 2)}\n`),
    writeFile(path.join(outputDir, 'yearly-summary.json'), `${JSON.stringify(yearly, null, 2)}\n`),
  ]);
  console.log(`Built operation-report compatibility summaries for ${records.length} record(s).`);
}

if (process.argv[1]?.endsWith('buildFeitsuiReservoirOperationMonthlyReportSummary.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
