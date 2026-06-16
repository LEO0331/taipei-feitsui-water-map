import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildWaterQualitySummary,
  classifyStationGroup,
  normalizeColumnName,
  normalizeStationName,
  parameterColumnMap,
  parameterKeys,
  parseRocYearMonthFromFilename,
  parseWaterQualityValue,
} from '../src/utils/waterQuality';
import type {
  ParameterSeriesPoint,
  StationLocation,
  WaterQualityParameterKey,
  WaterQualityRecord,
} from '../src/types/waterQuality';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/feitsui-water');
const publicDataDir = path.join(root, 'public/data');
const stationLocationsPath = path.join(publicDataDir, 'station-locations.json');

type ConversionIssue = {
  file: string;
  message: string;
};

type ResourceIndex = {
  resources?: Array<{
    file: string;
    title: string;
  }>;
};

function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('�') && utf8.includes('檢驗項目')) return utf8;
  return new TextDecoder('big5').decode(buffer);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

function resolveValue(row: Record<string, unknown>, parameter: WaterQualityParameterKey): unknown {
  const normalizedRow = new Map<string, unknown>();
  for (const [key, value] of Object.entries(row)) normalizedRow.set(normalizeColumnName(key).toLowerCase(), value);
  for (const candidate of parameterColumnMap[parameter]) {
    const value = normalizedRow.get(normalizeColumnName(candidate).toLowerCase());
    if (value !== undefined) return value;
  }
  return '';
}

function stationFromRow(row: Record<string, unknown>): string {
  const station = row['檢驗項目'] ?? row['測站'] ?? row['站名'] ?? row['stationName'] ?? '';
  return normalizeStationName(String(station));
}

function rowToRecord(
  row: Record<string, unknown>,
  source: string,
  periodInfo: ReturnType<typeof parseRocYearMonthFromFilename>,
  index: number,
): WaterQualityRecord | null {
  const stationName = stationFromRow(row);
  if (!stationName) return null;
  const stationGroup = classifyStationGroup(stationName);
  const values = Object.fromEntries(
    parameterKeys.map((parameter) => [parameter, parseWaterQualityValue(resolveValue(row, parameter))]),
  ) as WaterQualityRecord['values'];
  return {
    id: `${periodInfo.period}-${stationName}-${index}`,
    year: periodInfo.year,
    rocYear: periodInfo.rocYear,
    month: periodInfo.month,
    period: periodInfo.period,
    stationName,
    stationGroup,
    isSummaryRow: stationGroup === 'summary',
    sourceFileOrResource: source,
    values,
  };
}

function csvRowsToRecords(file: string, rows: string[][]): WaterQualityRecord[] {
  const [header = [], ...body] = rows;
  const periodInfo = parseRocYearMonthFromFilename(file);
  return body
    .map((row, index) => {
      const record = Object.fromEntries(header.map((name, columnIndex) => [normalizeColumnName(name), row[columnIndex] ?? '']));
      return rowToRecord(record, file, periodInfo, index);
    })
    .filter((record): record is WaterQualityRecord => record !== null);
}

function jsonRowsToRecords(file: string, rows: Array<Record<string, unknown>>, sourceTitle?: string): WaterQualityRecord[] {
  let periodInfo: ReturnType<typeof parseRocYearMonthFromFilename>;
  try {
    periodInfo = parseRocYearMonthFromFilename(sourceTitle ?? file);
  } catch {
    return [];
  }
  return rows
    .map((row, index) => rowToRecord(row, sourceTitle ?? file, periodInfo, index))
    .filter((record): record is WaterQualityRecord => record !== null);
}

function buildStationSeries(records: WaterQualityRecord[]) {
  return records.map((record) => ({
    period: record.period,
    stationName: record.stationName,
    stationGroup: record.stationGroup,
    values: record.values,
  }));
}

function buildParameterSeries(records: WaterQualityRecord[]): ParameterSeriesPoint[] {
  return records.flatMap((record) =>
    parameterKeys.map((parameter) => ({
      period: record.period,
      stationName: record.stationName,
      parameter,
      value: record.values[parameter].value,
      qualifier: record.values[parameter].qualifier,
    })),
  );
}

async function readStationLocations(records: WaterQualityRecord[]): Promise<StationLocation[]> {
  const existing = JSON.parse(await readFile(stationLocationsPath, 'utf8')) as StationLocation[];
  const known = new Map(existing.map((location) => [location.stationName, location]));
  for (const record of records) {
    if (!known.has(record.stationName)) {
      known.set(record.stationName, {
        stationName: record.stationName,
        latitude: null,
        longitude: null,
        stationGroup: record.stationGroup,
        isSummaryRow: record.isSummaryRow,
        coordinateStatus: 'missing',
      });
    }
  }
  return [...known.values()].sort((a, b) => a.stationName.localeCompare(b.stationName, 'zh-Hant'));
}

async function main() {
  await mkdir(publicDataDir, { recursive: true });
  const files = await readdir(rawDir);
  let resourceIndex: ResourceIndex = {};
  try {
    resourceIndex = JSON.parse(await readFile(path.join(rawDir, 'resource-index.json'), 'utf8')) as ResourceIndex;
  } catch {
    resourceIndex = {};
  }
  const resourceTitleByFile = new Map((resourceIndex.resources ?? []).map((resource) => [resource.file, resource.title]));
  const records: WaterQualityRecord[] = [];
  const issues: ConversionIssue[] = [];

  for (const file of files) {
    const fullPath = path.join(rawDir, file);
    if (file.endsWith('.csv')) {
      try {
        records.push(...csvRowsToRecords(file, parseCsv(decodeText(await readFile(fullPath)))));
      } catch (error) {
        issues.push({ file, message: String(error) });
      }
    }
    if (file.endsWith('.json') && !['manual-resources.json', 'resource-index.json'].includes(file)) {
      try {
        const json = JSON.parse(await readFile(fullPath, 'utf8')) as {
          result?: { results?: Array<Record<string, unknown>> };
          resource?: { title?: string };
        };
        records.push(...jsonRowsToRecords(file, json.result?.results ?? [], json.resource?.title ?? resourceTitleByFile.get(file)));
      } catch (error) {
        issues.push({ file, message: String(error) });
      }
    }
  }

  records.sort((a, b) => `${a.period}-${a.stationName}`.localeCompare(`${b.period}-${b.stationName}`, 'zh-Hant'));
  const stationLocations = await readStationLocations(records);
  const summary = buildWaterQualitySummary(records);
  const report = {
    generatedAt: new Date().toISOString(),
    rawDirectory: rawDir,
    recordCount: records.length,
    periods: summary.periods,
    stations: [...new Set(records.map((record) => record.stationName))],
    blankRowsDropped: true,
    valueParsing: {
      ND: 'not_detected',
      '<n': 'less_than with numeric threshold preserved as value',
      '-': 'missing',
      empty: 'missing',
    },
    summaryRows: records.filter((record) => record.isSummaryRow).map((record) => record.stationName),
    coordinatePolicy: 'Only stations with verified coordinates in station-locations.json should render as map markers.',
    issues,
  };

  await writeFile(path.join(publicDataDir, 'station-locations.json'), `${JSON.stringify(stationLocations, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'water-quality-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'water-quality-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'water-quality-station-series.json'), `${JSON.stringify(buildStationSeries(records), null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'water-quality-parameter-series.json'), `${JSON.stringify(buildParameterSeries(records), null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'conversion-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Converted ${records.length} records across ${summary.periods.length} period(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
