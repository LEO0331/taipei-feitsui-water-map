import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addMonthOverMonthAndYearOverYearChanges, addRolling12MonthSums, buildTapWaterBusinessKeyMetricSummary, cleanText, deriveTapWaterBusinessMetrics, parseMetricNumber, parseRocYearMonth } from '../src/utils/tapWaterBusiness';
import type { TapWaterBusinessKeyMetricRecord } from '../src/types/tapWaterBusiness';

const rawDir = path.join(process.cwd(), 'data/raw/tap-water-business-key-metrics');
const publicDir = path.join(process.cwd(), 'public/data');
const source = '臺北自來水事業處業務關鍵數據';
const sourceAgency = '臺北自來水事業處';

const columns = {
  distributedWaterVolumeM3: '配水量（立方公尺）',
  directDrinkingFountainCount: '自來水直飲台數量（台）',
  onlineWaterQualityMonitoringStationCount: '線上水質監測站數量（站）',
  averageWaterPressureKgCm2: '平均水壓（kg/cm2）',
  transmissionDistributionPipelineLengthKm: '輸配水管線長度（公里）',
  billedWaterVolumeM3: '計費水量（立方公尺）',
  taiwanWaterSupportVolumeM3: '支援台水水量（立方公尺）',
  waterUseExcludingTaiwanWaterSupportM3: '扣支援台水水量後之用水量（立方公尺）',
  supplyAreaTotalPopulation: '供水區域之總人口數（人）',
  supplyAreaServedPopulation: '供水區域用水人口數（人）',
  supplyCoverageRatePercent: '供水普及率（%）',
  userCount: '用戶數（戶）',
  perCapitaDailyWaterUseLiter: '每人每日平均用水量（公升）',
  employeeCount: '員工人數（人）',
  staffCount: '職員（人）',
  workerCount: '工員（人）',
  usersPerEmployee: '每員工平均服務用戶數（戶）',
  monthlyRevenueThousandNtd: '本月收入（千元）',
  salesRevenueThousandNtd: '銷貨收入（千元）',
  serviceRevenueThousandNtd: '勞務收入（千元）',
  otherOperatingRevenueThousandNtd: '其他營業收入（千元）',
  nonOperatingRevenueThousandNtd: '營業外收入（千元）',
  monthlyExpenseThousandNtd: '本月支出（千元）',
  salesCostThousandNtd: '銷貨成本（千元）',
  serviceCostThousandNtd: '勞務成本（千元）',
  otherOperatingCostThousandNtd: '其他營業成本（千元）',
  nonOperatingExpenseThousandNtd: '營業外費用（千元）',
  monthlySurplusThousandNtd: '本月盈餘（千元）',
  assetsThousandNtd: '資產（千元）',
  liabilitiesThousandNtd: '負債（千元）',
  equityThousandNtd: '業主權益（千元）',
} satisfies Record<string, string>;

function decode(buffer: Buffer) {
  const big5 = new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
  return big5.includes('年月') && big5.includes('配水量') ? big5 : buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function csv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 16);

async function main() {
  await mkdir(publicDir, { recursive: true });
  let metadata: { files?: Array<{ file: string; resourceName?: string }> } = {};
  try { metadata = JSON.parse(await readFile(path.join(rawDir, 'source-metadata.json'), 'utf8')); } catch { /* local fallback */ }
  const discovered = (await readdir(rawDir)).filter((file) => file.endsWith('.csv')).map((file) => ({ file, resourceName: source }));
  const sourceFiles = metadata.files?.filter((file) => file.file.endsWith('.csv')) ?? discovered;
  const warnings: Array<{ file: string; row?: number; issue: string; value?: string }> = [];
  const duplicateMonthKeys: string[] = [];
  const seen = new Set<string>();
  let missingMetricValueCount = 0;
  let invalidNumericValueCount = 0;
  let invalidPeriodCount = 0;
  const records: TapWaterBusinessKeyMetricRecord[] = [];

  for (const sourceFile of sourceFiles) {
    const rows = csv(decode(await readFile(path.join(rawDir, sourceFile.file))));
    const [header = [], ...body] = rows;
    const headers = header.map((value) => value.trim());
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(headers.map((name, column) => [name, cleanText(values[column])]));
      const period = parseRocYearMonth(row['年月']);
      if (!period.periodRaw || !period.rocYear || !period.year || !period.month || !period.monthKey || !period.periodDate || !period.quarter || !period.yearMonthLabel) {
        invalidPeriodCount += 1;
        warnings.push({ file: sourceFile.file, row: index + 2, issue: period.warning ?? 'Invalid period', value: row['年月'] });
        continue;
      }
      if (seen.has(period.monthKey)) duplicateMonthKeys.push(period.monthKey); else seen.add(period.monthKey);
      const parsed: Record<string, number | undefined> = {};
      for (const [key, column] of Object.entries(columns)) {
        const result = parseMetricNumber(row[column]);
        if (result.value === undefined) missingMetricValueCount += 1;
        if (result.warning) { invalidNumericValueCount += 1; warnings.push({ file: sourceFile.file, row: index + 2, issue: result.warning, value: result.raw }); }
        parsed[key] = result.value;
      }
      const record = deriveTapWaterBusinessMetrics({
        id: period.monthKey,
        module: 'tap_water_business_key_metrics',
        periodRaw: period.periodRaw,
        rocYear: period.rocYear,
        year: period.year,
        month: period.month,
        monthKey: period.monthKey,
        periodDate: period.periodDate,
        quarter: period.quarter,
        yearMonthLabel: period.yearMonthLabel,
        isLatestMonth: false,
        ...parsed,
        sourceRecordHash: hash([sourceFile.resourceName ?? source, period.periodRaw].join('|')),
        source,
        sourceAgency,
      } as TapWaterBusinessKeyMetricRecord);
      records.push(record);
    }
  }

  const sorted = addRolling12MonthSums(addMonthOverMonthAndYearOverYearChanges(records).sort((a, b) => a.monthKey.localeCompare(b.monthKey)));
  const latestMonth = sorted.at(-1)?.monthKey;
  const finalRecords = sorted.map((record) => ({ ...record, isLatestMonth: record.monthKey === latestMonth }));
  const summary = buildTapWaterBusinessKeyMetricSummary(finalRecords, { invalidPeriodCount, missingMetricValueCount, invalidNumericValueCount, duplicateMonthKeyCount: new Set(duplicateMonthKeys).size });
  const latest = finalRecords.filter((record) => record.isLatestMonth);
  await writeFile(path.join(publicDir, 'tap-water-business-key-metrics.json'), `${JSON.stringify(finalRecords, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-business-key-metric-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-business-key-metric-latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-business-key-metric-conversion-report.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), officialDataset: source, sourceAgency: '北水處', sources: sourceFiles, recordCount: finalRecords.length, warningCount: warnings.length, warnings: warnings.slice(0, 100), duplicateMonthKeys: [...new Set(duplicateMonthKeys)], notes: ['CSV has no coordinates, address, district, or facility point fields; no geocoding or map markers are produced.', 'Derived ratios are source-field calculations, not official audit, rating, forecast, or performance conclusions.'] }, null, 2)}\n`);
  console.log(`Converted ${finalRecords.length} Taipei Water business key metric record(s) from ${sourceFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
