import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  aggregateHydrometMonthlySummary,
  aggregateHydrometParameterSeries,
  hydrometColumnMap,
  hydrometParameterKeys,
  normalizeHydrometColumnName,
  parseHydrometDate,
  parseHydrometValue,
} from '../src/utils/hydromet';
import type { HydrometDailyRecord, HydrometParameterKey } from '../src/types/hydromet';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/feitsui-hydromet');
const publicDataDir = path.join(root, 'public/data');

function resolveValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedRow = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) {
    normalizedRow.set(normalizeHydrometColumnName(key), value);
  }
  for (const candidate of candidates) {
    const value = normalizedRow.get(normalizeHydrometColumnName(candidate));
    if (value !== undefined) return value;
  }
  return '';
}

function resolveDate(row: Record<string, unknown>): string {
  return String(resolveValue(row, ['日期', 'date']));
}

function resolveWindDirection(row: Record<string, unknown>): string | null {
  const raw = String(resolveValue(row, ['風向d', '風向'])).trim();
  return raw && raw !== '-' ? raw : null;
}

function rowToRecord(row: Record<string, unknown>, sourceResource: string, index: number): HydrometDailyRecord | null {
  const rawDate = resolveDate(row);
  if (!rawDate.trim()) return null;
  const date = parseHydrometDate(rawDate);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  const year = parsedDate.getUTCFullYear();
  const month = parsedDate.getUTCMonth() + 1;
  const day = parsedDate.getUTCDate();
  const period = `${year}-${String(month).padStart(2, '0')}`;

  return {
    id: `${date}-${sourceResource}-${index}`,
    date,
    year,
    month,
    day,
    weekday: parsedDate.getUTCDay(),
    period,
    windDirection: resolveWindDirection(row),
    values: {
      windSpeedMS: parseHydrometValue(resolveValue(row, hydrometColumnMap.windSpeedMS)),
      airPressureMb: parseHydrometValue(resolveValue(row, hydrometColumnMap.airPressureMb)),
      solarRadiationCalCm2: parseHydrometValue(resolveValue(row, hydrometColumnMap.solarRadiationCalCm2)),
      evaporationMm: parseHydrometValue(resolveValue(row, hydrometColumnMap.evaporationMm)),
      relativeHumidityPercent: parseHydrometValue(resolveValue(row, hydrometColumnMap.relativeHumidityPercent)),
      maxTemperatureC: parseHydrometValue(resolveValue(row, hydrometColumnMap.maxTemperatureC)),
      minTemperatureC: parseHydrometValue(resolveValue(row, hydrometColumnMap.minTemperatureC)),
      avgTemperatureC: parseHydrometValue(resolveValue(row, hydrometColumnMap.avgTemperatureC)),
    },
    sourceResource,
  };
}

function buildParameterSeries(records: HydrometDailyRecord[]) {
  return hydrometParameterKeys.flatMap((parameter) =>
    aggregateHydrometParameterSeries(records, parameter as HydrometParameterKey),
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

  const records: HydrometDailyRecord[] = [];
  const issues: Array<{ file: string; message: string }> = [];
  for (const file of files) {
    if (!file.endsWith('.json') || ['manual-resources.json', 'resource-index.json'].includes(file)) continue;
    try {
      const json = JSON.parse(await readFile(path.join(rawDir, file), 'utf8')) as {
        resource?: { title?: string };
        result?: { results?: Array<Record<string, unknown>> };
      };
      for (const [index, row] of (json.result?.results ?? []).entries()) {
        const record = rowToRecord(row, json.resource?.title ?? file, index);
        if (record) records.push(record);
      }
    } catch (error) {
      issues.push({ file, message: error instanceof Error ? error.message : String(error) });
    }
  }

  records.sort((a, b) => a.date.localeCompare(b.date));
  const monthlySummary = aggregateHydrometMonthlySummary(records);
  const report = {
    generatedAt: new Date().toISOString(),
    rawDirectory: rawDir,
    recordCount: records.length,
    periods: monthlySummary.map((summary) => summary.period),
    issues,
  };

  await writeFile(path.join(publicDataDir, 'hydromet-daily-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'hydromet-monthly-summary.json'), `${JSON.stringify(monthlySummary, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'hydromet-parameter-series.json'), `${JSON.stringify(buildParameterSeries(records), null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'hydromet-conversion-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Converted ${records.length} hydromet daily record(s) across ${monthlySummary.length} period(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
