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

  return {
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
  };
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

  records.sort((a, b) => a.date.localeCompare(b.date));
  const monthlySummary = aggregateOperationMonthlySummary(records);
  const report = {
    generatedAt: new Date().toISOString(),
    rawDirectory: rawDir,
    recordCount: records.length,
    periods: monthlySummary.map((summary) => summary.period),
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
