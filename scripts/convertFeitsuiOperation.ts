import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  aggregateOperationMonthlySummary,
  aggregateOperationParameterSeries,
  normalizeOperationColumnName,
  operationColumnMap,
  operationParameterKeys,
  parseOperationDate,
  parseOperationValue,
  parsePeriodFromTitle,
} from '../src/utils/operation';
import type { OperationDailyRecord, OperationParameterKey } from '../src/types/operation';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/feitsui-operation');
const csvRawDir = path.join(root, 'data/raw/feitsui-reservoir-operation-monthly-reports');
const publicDataDir = path.join(root, 'public/data');

function resolveValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedRow = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalizedRow.set(normalizeOperationColumnName(key), value);
  }
  for (const candidate of candidates) {
    const value = normalizedRow.get(normalizeOperationColumnName(candidate));
    if (value !== undefined) return value;
  }
  return '';
}

function resolveDate(row: Record<string, unknown>): string {
  return String(resolveValue(row, ['日期', 'date']));
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(field.trim()); field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim()); field = '';
      if (row.some((item) => item)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some((item) => item)) rows.push(row);
  const [headers = [], ...body] = rows;
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header.trim(), values[index]?.trim() ?? ''])));
}

function decodeCsv(buffer: Buffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/^\uFEFF/, '');
  // Replacement characters are strong evidence that a legacy Big5/CP950 export was supplied.
  return utf8.includes('\uFFFD') ? new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '') : utf8;
}

function enrichRecord(record: OperationDailyRecord, sourceResourceYearMonth: string | null): OperationDailyRecord {
  const rainfall = record.values.catchmentAverageRainfallMm.value;
  const waterLevel = record.values.dailyAverageWaterLevelM.value;
  const net = record.values.inflowMinusOutflowM3.value;
  const missing = Object.entries(record.values).filter(([, item]) => item.value === null).map(([key]) => key);
  return {
    ...record,
    sourceResourceName: record.sourceResource,
    sourceResourceYearMonth,
    storageCubicMeters: record.values.effectiveStorageMillionM3.value === null ? null : record.values.effectiveStorageMillionM3.value * 1_000_000,
    storageBillionCubicMeters: record.values.effectiveStorageMillionM3.value === null ? null : record.values.effectiveStorageMillionM3.value / 1_000,
    inflowMillionCubicMeters: record.values.reservoirInflowM3.value === null ? null : record.values.reservoirInflowM3.value / 1_000_000,
    releaseMillionCubicMeters: record.values.reservoirOutflowM3.value === null ? null : record.values.reservoirOutflowM3.value / 1_000_000,
    inflowMinusReleaseMillionCubicMeters: net === null ? null : net / 1_000_000,
    netStorageChangeDirection: net === null ? 'unknown' : net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral',
    rainfallCategory: rainfall === null ? 'unknown' : rainfall === 0 ? 'none' : rainfall < 10 ? 'light' : rainfall < 50 ? 'moderate' : 'heavy',
    // The source has no official water-level thresholds. These neutral bands support filtering only.
    waterLevelCategory: waterLevel === null ? 'unknown' : waterLevel < 160 ? 'low' : waterLevel >= 170 ? 'high' : 'normal',
    dataQualityFlags: missing.map((key) => `missing:${key}`),
  };
}

function rowToRecord(
  row: Record<string, unknown>,
  sourceResource: string,
  fallbackPeriod: string | null,
  index: number,
  issues: Array<{ file: string; message: string }>,
): OperationDailyRecord | null {
  const rawDate = resolveDate(row);
  if (!rawDate.trim()) return null;
  const date = parseOperationDate(rawDate, fallbackPeriod ?? undefined);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const year = parsedDate.getUTCFullYear();
  const month = parsedDate.getUTCMonth() + 1;
  const day = parsedDate.getUTCDate();
  const period = `${year}-${String(month).padStart(2, '0')}`;
  if (fallbackPeriod && period !== fallbackPeriod) {
    issues.push({
      file: sourceResource,
      message: `Row date ${date} does not match resource period ${fallbackPeriod}.`,
    });
  }

  return enrichRecord({
    id: `${date}-${sourceResource}-${index}`,
    date,
    year,
    month,
    day,
    weekday: parsedDate.getUTCDay(),
    period,
    values: {
      dailyAverageWaterLevelM: parseOperationValue(resolveValue(row, operationColumnMap.dailyAverageWaterLevelM)),
      effectiveStorageMillionM3: parseOperationValue(resolveValue(row, operationColumnMap.effectiveStorageMillionM3)),
      catchmentAverageRainfallMm: parseOperationValue(resolveValue(row, operationColumnMap.catchmentAverageRainfallMm)),
      reservoirInflowM3: parseOperationValue(resolveValue(row, operationColumnMap.reservoirInflowM3)),
      reservoirOutflowM3: parseOperationValue(resolveValue(row, operationColumnMap.reservoirOutflowM3)),
      inflowMinusOutflowM3: parseOperationValue(resolveValue(row, operationColumnMap.inflowMinusOutflowM3)),
      nanshiRiverFlowM3: parseOperationValue(resolveValue(row, operationColumnMap.nanshiRiverFlowM3)),
      combinedRawWaterM3: parseOperationValue(resolveValue(row, operationColumnMap.combinedRawWaterM3)),
    },
    sourceResource,
  }, fallbackPeriod);
}

function buildParameterSeries(records: OperationDailyRecord[]) {
  return operationParameterKeys.flatMap((parameter) =>
    aggregateOperationParameterSeries(records, parameter as OperationParameterKey),
  );
}

async function main() {
  await mkdir(publicDataDir, { recursive: true });
  let files: string[] = [];
  try {
    files = await readdir(rawDir);
  } catch {
    files = [];
  }

  const records: OperationDailyRecord[] = [];
  const issues: Array<{ file: string; message: string }> = [];
  for (const file of files) {
    if (!file.endsWith('.json') || ['manual-resources.json', 'resource-index.json'].includes(file)) continue;
    try {
      const json = JSON.parse(await readFile(path.join(rawDir, file), 'utf8')) as {
        resource?: { title?: string };
        result?: { results?: Array<Record<string, unknown>> };
      };
      const sourceResource = json.resource?.title ?? file;
      const fallbackPeriod = parsePeriodFromTitle(sourceResource);
      for (const [index, row] of (json.result?.results ?? []).entries()) {
        const record = rowToRecord(row, sourceResource, fallbackPeriod, index, issues);
        if (record) records.push(record);
      }
    } catch (error) {
      issues.push({ file, message: error instanceof Error ? error.message : String(error) });
    }
  }

  try {
    const csvFiles = (await readdir(csvRawDir)).filter((file) => file.toLowerCase().endsWith('.csv'));
    for (const file of csvFiles) {
      try {
        const sourceResource = file;
        const fallbackPeriod = parsePeriodFromTitle(file);
        const rows = parseCsv(decodeCsv(await readFile(path.join(csvRawDir, file))));
        for (const [index, row] of rows.entries()) {
          const record = rowToRecord(row, sourceResource, fallbackPeriod, index, issues);
          if (record) records.push(record);
        }
      } catch (error) {
        issues.push({ file, message: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch {
    // Local CSV ingestion is optional; the API JSON raw directory remains the established default.
  }

  records.sort((a, b) => a.date.localeCompare(b.date));
  const monthlySummary = aggregateOperationMonthlySummary(records);
  const report = {
    generatedAt: new Date().toISOString(),
    rawDirectory: rawDir,
    recordCount: records.length,
    periods: monthlySummary.map((summary) => summary.period),
    notes: [
      'Reads API JSON resources and optional manually placed UTF-8-SIG or Big5/CP950-compatible CSV files.',
      'Water-level categories are neutral exploration bands only; they are not official thresholds or drought/flood determinations.',
    ],
    issues,
  };

  await writeFile(path.join(publicDataDir, 'operation-daily-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'operation-monthly-summary.json'), `${JSON.stringify(monthlySummary, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'operation-parameter-series.json'), `${JSON.stringify(buildParameterSeries(records), null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'operation-conversion-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Converted ${records.length} operation daily record(s) across ${monthlySummary.length} period(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
