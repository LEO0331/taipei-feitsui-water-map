import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { cleanText, deriveSupportMetrics, parseSupportMonthDate, parseWaterVolume } from '../src/utils/twcSupport';
import type { TaipeiWaterSupportTwcMonthlyRecord } from '../src/types/twcSupport';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/taipei-water-support-twc-monthly-statistics');
const publicDir = path.join(root, 'public/data');

function decodeText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  return !utf8.includes('�') && utf8.includes('合計水量') ? utf8 : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index], next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  const files = (await readdir(rawDir)).filter((file) => file.endsWith('.csv')).sort();
  const warnings: string[] = [];
  const invalid: Array<{ file: string; row: number; field: string; raw?: string }> = [];
  const dailyRowsByMonth = new Map<string, TaipeiWaterSupportTwcMonthlyRecord[]>();
  let dailyRowCount = 0;

  for (const file of files) {
    const rows = parseCsv(decodeText(await readFile(path.join(rawDir, file))));
    const [header = [], ...body] = rows;
    const columns = header.map((name) => name.trim());
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(columns.map((column, columnIndex) => [column, cleanText(values[columnIndex])]));
      const fallbackRocYear = Number(file.match(/\d{3}/)?.[0]) || undefined;
      const dates = parseSupportMonthDate(row['日期'], fallbackRocYear);
      if (dates.warning) invalid.push({ file, row: index + 2, field: '日期', raw: row['日期'] });
      if (!dates.monthKey) continue;
      dailyRowCount += 1;
      const total = parseWaterVolume(row['合計水量']);
      const first = parseWaterVolume(row['支援第一區處水量']);
      const twelfth = parseWaterVolume(row['支援第十二區處水量']);
      if (total !== undefined && first !== undefined && twelfth !== undefined && Math.abs(total - first - twelfth) > 0.001) {
        warnings.push(`${file} ${dates.monthKey}: total differs from destination sum.`);
      }
      const dailyRecord: TaipeiWaterSupportTwcMonthlyRecord = {
        id: `${dates.monthKey}-${index + 1}`,
        module: 'taipei_water_support_twc_monthly_statistics',
        sourceSequenceNumber: parseWaterVolume(row['序號']),
        ...dates,
        dataYear: dates.year,
        totalSupportVolume: total,
        firstDistrictOfficeSupportVolume: first,
        twelfthDistrictOfficeSupportVolume: twelfth,
        supportVolumeUnit: 'raw',
        isLatestMonth: false,
        source: '臺北自來水事業處支援台水月統計表',
        sourceAgency: '臺北自來水事業處',
      };
      if (!dailyRowsByMonth.has(dates.monthKey)) dailyRowsByMonth.set(dates.monthKey, []);
      dailyRowsByMonth.get(dates.monthKey)!.push(dailyRecord);
    }
  }

  const monthlyRecords = [...dailyRowsByMonth.entries()].map(([monthKey, dailyRecords]) => {
    const first = dailyRecords[0];
    const record: TaipeiWaterSupportTwcMonthlyRecord = {
      ...first,
      id: monthKey,
      sourceSequenceNumber: undefined,
      dateRaw: monthKey,
      totalSupportVolume: dailyRecords.reduce((total, item) => total + (item.totalSupportVolume ?? 0), 0),
      firstDistrictOfficeSupportVolume: dailyRecords.reduce((total, item) => total + (item.firstDistrictOfficeSupportVolume ?? 0), 0),
      twelfthDistrictOfficeSupportVolume: dailyRecords.reduce((total, item) => total + (item.twelfthDistrictOfficeSupportVolume ?? 0), 0),
    };
    return record;
  });
  const records = deriveSupportMetrics(monthlyRecords);
  await writeFile(path.join(publicDir, 'taipei-water-support-twc-monthly-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'taipei-water-support-twc-conversion-report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    officialDataset: '臺北自來水事業處支援台水月統計表',
    sourceAgency: '北水處',
    supportVolumeUnit: 'raw',
    files,
    dailySourceRowCount: dailyRowCount,
    recordCount: records.length,
    warnings: [...new Set(warnings)],
    duplicateMonths: [],
    invalid,
    notes: ['Source field names use 水量 but do not state a unit; values are preserved as raw water-volume numbers.'],
  }, null, 2)}\n`);
  console.log(`Converted ${records.length} Taipei Water support-to-TWC monthly record(s) from ${files.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
