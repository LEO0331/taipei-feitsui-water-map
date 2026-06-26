import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPumpingStationSummary, convertTwd97ToWgs84, coordinateStatus, normalizeRiverSystem, normalizeTaipeiDistrict, parseEstablishedDate, parseManagementDistrictNumber } from '../src/utils/pumpingStations';
import type { PumpingStation } from '../src/types/pumpingStations';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/pumping-stations');
const publicDir = path.join(root, 'public/data');
function csv(text: string) { const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < text.length; i += 1) { const char = text[i], next = text[i + 1]; if (char === '"' && quoted && next === '"') { cell += char; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; } else cell += char; } if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); } return rows; }
function number(raw: string | undefined) { const value = Number(raw); return Number.isFinite(value) ? value : undefined; }
async function main() {
  await mkdir(publicDir, { recursive: true });
  const file = (await readdir(rawDir)).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!file) throw new Error('No pumping station CSV found in data/raw/pumping-stations.');
  const buffer = await readFile(path.join(rawDir, file));
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const text = utf8.includes('站名') ? utf8 : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
  const [header, ...rows] = csv(text); const headers = header.map((value) => value.trim());
  const issues: Array<{ row: number; issue: string; value?: string }> = [];
  const records = rows.map((values, index): PumpingStation => {
    const row = Object.fromEntries(headers.map((name, column) => [name, values[column]?.trim() || undefined]));
    const xRaw = row['X坐標'], yRaw = row['Y坐標']; const xTwd97 = number(xRaw), yTwd97 = number(yRaw);
    const status = (!xRaw || !yRaw) ? 'missing' : (xTwd97 === undefined || yTwd97 === undefined) ? 'unparsed' : coordinateStatus(xTwd97, yTwd97);
    if (status !== 'valid') issues.push({ row: index + 2, issue: `coordinate_${status}`, value: `${xRaw ?? ''},${yRaw ?? ''}` });
    const dates = parseEstablishedDate(row['建置日期']); if (dates.warning) issues.push({ row: index + 2, issue: dates.warning, value: dates.establishedDateRaw });
    const point = status === 'valid' ? convertTwd97ToWgs84(xTwd97!, yTwd97!) : undefined;
    return { id: `${row.NO ?? 'unknown'}|${row['站名'] ?? index}`, type: 'pumping_station', sourceSequenceNumber: number(row.NO), stationName: row['站名'] ?? `Unknown ${index + 1}`, riverSystem: row.河系, riverSystemNormalized: normalizeRiverSystem(row.河系), district: row.行政區域, districtNormalized: normalizeTaipeiDistrict(row.行政區域), ...dates, stationAgeYears: dates.establishedYear ? new Date().getFullYear() - dates.establishedYear : undefined, managementUnit: row.管理單位, managementDistrictNumber: parseManagementDistrictNumber(row.管理單位), xTwd97, yTwd97, ...point, coordinateStatus: status, source: '臺北市水利處抽水站', sourceAgency: '臺北市政府工務局水利工程處' };
  });
  const summary = buildPumpingStationSummary(records);
  await writeFile(path.join(publicDir, 'pumping-stations.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'pumping-station-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'pumping-station-conversion-report.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), source: { file, encoding: utf8.includes('站名') ? 'UTF-8-SIG' : 'Big5/CP950', recordCount: records.length }, coordinateIssues: issues, notes: ['TWD97-TM2(zone121) converted to WGS84 with EPSG:3826.', '建置日期 parsed as Gregorian YYYYMMDD.'] }, null, 2)}\n`);
  console.log(`Converted ${records.length} pumping station record(s).`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
