import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildParkWaterSafetyEquipmentSummary, classifyParkWaterSafetyFacility, cleanText, parseDistrictFromResourceNameOrLocation, parseParkName, parseParkWaterSafetyCoordinates } from '../src/utils/parkWaterSafety';
import type { ParkWaterSafetyEquipmentRecord } from '../src/types/parkWaterSafety';

const rawDir = path.join(process.cwd(), 'data/raw/park-water-safety-equipment');
const publicDir = path.join(process.cwd(), 'public/data');

function decode(buffer: Buffer) {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  return !utf8.includes('�') && (utf8.includes('位置') || utf8.includes('設施名稱')) ? utf8 : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
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

const normalizedCode = (value?: string) => cleanText(value)?.replace(/\s+/g, '').toUpperCase();
const pick = (row: Record<string, string | undefined>, names: string[]) => names.map((name) => row[name]).find(Boolean);
const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 12);

async function main() {
  await mkdir(publicDir, { recursive: true });
  const metadata = JSON.parse(await readFile(path.join(rawDir, 'source-metadata.json'), 'utf8')) as { files?: Array<{ file: string; resourceName: string; encoding?: string }> };
  const sourceFiles = metadata.files?.filter((item) => item.file.endsWith('.csv')) ?? (await readdir(rawDir)).filter((file) => file.endsWith('.csv')).map((file) => ({ file, resourceName: file }));
  const records: ParkWaterSafetyEquipmentRecord[] = [];
  const coordinateIssues: Array<{ file: string; row: number; issue: string; value?: string }> = [];
  const duplicateEquipmentCodes: string[] = [];
  const duplicateFallbackKeys: string[] = [];
  const seenCodes = new Set<string>();
  const seenFallback = new Set<string>();

  for (const source of sourceFiles) {
    const rows = csv(decode(await readFile(path.join(rawDir, source.file))));
    const [header = [], ...body] = rows;
    const headers = header.map((value) => value.trim());
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(headers.map((name, column) => [name, cleanText(values[column])]));
      const locationDescription = pick(row, ['位置']);
      const facilityNameRaw = pick(row, ['設施名稱']);
      const equipmentCode = pick(row, ['設備編碼']);
      const coords = parseParkWaterSafetyCoordinates(pick(row, ['座標(經度)', '經度']), pick(row, ['座標(緯度)', '緯度']));
      if (coords.coordinateStatus !== 'valid') coordinateIssues.push({ file: source.file, row: index + 2, issue: coords.warning ?? coords.coordinateStatus, value: `${coords.sourceX ?? ''},${coords.sourceY ?? ''}` });
      const district = parseDistrictFromResourceNameOrLocation(source.resourceName, locationDescription);
      const fallbackKey = [district, locationDescription, facilityNameRaw, coords.sourceX, coords.sourceY].map((value) => value ?? '').join('|');
      const code = normalizedCode(equipmentCode);
      if (code && seenCodes.has(code)) duplicateEquipmentCodes.push(code); else if (code) seenCodes.add(code);
      if (seenFallback.has(fallbackKey)) duplicateFallbackKeys.push(fallbackKey); else seenFallback.add(fallbackKey);
      const sourceRecordHash = hash([source.resourceName, locationDescription, facilityNameRaw, equipmentCode, coords.sourceX, coords.sourceY].join('|'));
      records.push({
        id: sourceRecordHash,
        module: 'park_water_safety_equipment',
        resourceName: source.resourceName,
        district,
        districtNormalized: district,
        parkName: parseParkName(locationDescription, source.resourceName),
        locationDescription,
        facilityNameRaw,
        facilityNameNormalized: facilityNameRaw,
        facilityCategory: classifyParkWaterSafetyFacility(facilityNameRaw),
        equipmentCode,
        equipmentCodeNormalized: code,
        ...coords,
        hasCoordinates: coords.coordinateStatus === 'valid',
        sourceRecordHash,
        source: '臺北市各公園水域安全告示牌及救生設備位置資訊',
        sourceAgency: '臺北市政府工務局公園路燈工程管理處',
      });
    }
  }

  const summary = buildParkWaterSafetyEquipmentSummary(records);
  await writeFile(path.join(publicDir, 'park-water-safety-equipment-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'park-water-safety-equipment-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'park-water-safety-equipment-conversion-report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    officialDataset: '臺北市各公園水域安全告示牌及救生設備位置資訊',
    sourceAgency: '工務局公園處',
    sources: sourceFiles,
    recordCount: records.length,
    coordinateIssues,
    duplicateEquipmentCodes: [...new Set(duplicateEquipmentCodes)],
    duplicateFallbackKeys: [...new Set(duplicateFallbackKeys)].slice(0, 50),
    notes: ['Source says coordinates are TWD97; WGS84-like values are also accepted defensively before Leaflet rendering.'],
  }, null, 2)}\n`);
  console.log(`Converted ${records.length} park water-safety equipment record(s) from ${sourceFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
