import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  inferRocYearFromFileName,
  parseRiverWaterQualityValue,
  riverColumnMap,
} from '../src/utils/riverWaterQuality';
import {
  riverIndicatorKeys,
  type RiverWaterQualityRecord,
} from '../src/types/riverWaterQuality';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/river-water-quality');
const publicDataDir = path.join(root, 'public/data');

function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  return !utf8.includes('�') && utf8.includes('河川名稱')
    ? utf8
    : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
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
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function rowToRecord(
  row: Record<string, string>,
  file: string,
  index: number,
  warnings: string[],
  unparsed: Array<{ file: string; row: number; indicator: string; raw?: string }>,
): RiverWaterQualityRecord | null {
  const riverName = row['河川名稱']?.trim();
  const stationName = row['監測站']?.trim();
  const month = Number(row['月份']);
  if (!riverName || !stationName || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const yearRoc = inferRocYearFromFileName(file);
  if (!yearRoc) warnings.push(`Could not infer ROC year from ${file}.`);
  const values = Object.fromEntries(riverIndicatorKeys.map((key) => {
    const { column, unit } = riverColumnMap[key];
    const value = parseRiverWaterQualityValue(row[column], unit);
    if (value.qualifier === 'unparsed') unparsed.push({ file, row: index + 2, indicator: key, raw: value.raw });
    return [key, value];
  })) as Pick<RiverWaterQualityRecord, typeof riverIndicatorKeys[number]>;

  return {
    id: `${yearRoc ?? 'unknown'}-${String(month).padStart(2, '0')}-${row['序號'] || index}-${riverName}-${stationName}`,
    module: 'river_water_quality',
    yearRoc,
    year: yearRoc ? yearRoc + 1911 : undefined,
    month,
    sequenceNumber: Number(row['序號']) || undefined,
    riverName,
    stationName,
    source: '臺北市河川水質檢測',
    ...values,
  };
}

async function main() {
  await mkdir(publicDataDir, { recursive: true });
  const files = (await readdir(rawDir)).filter((file) => file.toLowerCase().endsWith('.csv')).sort();
  const records: RiverWaterQualityRecord[] = [];
  const warnings: string[] = [];
  const unparsed: Array<{ file: string; row: number; indicator: string; raw?: string }> = [];
  const sources: Array<{ file: string; recordCount: number; encoding: string }> = [];

  for (const file of files) {
    const rows = parseCsv(decodeText(await readFile(path.join(rawDir, file))));
    const [header = [], ...body] = rows;
    const normalizedHeader = header.map((name) => name.trim());
    const before = records.length;
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(normalizedHeader.map((name, columnIndex) => [name, values[columnIndex]?.trim() ?? '']));
      const record = rowToRecord(row, file, index, warnings, unparsed);
      if (record) records.push(record);
    }
    sources.push({ file, recordCount: records.length - before, encoding: 'Big5/CP950 or UTF-8-SIG' });
  }

  records.sort((a, b) => `${a.year}-${a.month}-${a.sequenceNumber}`.localeCompare(`${b.year}-${b.month}-${b.sequenceNumber}`));
  await writeFile(path.join(publicDataDir, 'river-water-quality-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'river-water-quality-conversion-report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    sources,
    warnings: [...new Set(warnings)],
    unparsed,
  }, null, 2)}\n`);
  console.log(`Converted ${records.length} river water-quality record(s) from ${files.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
