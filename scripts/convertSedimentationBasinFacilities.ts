import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSedimentationBasinFacilitySummary, classifySedimentationBasinCatchmentArea, cleanText, convertTwd97Tm2ToWgs84, createSedimentationBasinMapQuery, parseCatchmentArea, parseSourceCoordinate, parseTaipeiDistrictName } from '../src/utils/sedimentationBasins';
import type { SedimentationBasinFacilityRecord } from '../src/types/sedimentationBasins';

const root = process.cwd();
const rawDir = path.join(root, 'data/raw/sedimentation-basin-facilities');
const publicDir = path.join(root, 'public/data');
function csv(text: string) { const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < text.length; i += 1) { const char = text[i], next = text[i + 1]; if (char === '"' && quoted && next === '"') { cell += char; i += 1; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; } else cell += char; } if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); } return rows; }
const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 12);
const norm = (value: unknown) => cleanText(value)?.replace(/\s+/g, ' ');
const numSeq = (value: string | undefined) => Number(value?.match(/\d+/)?.[0]) || undefined;
const duplicateCount = (values: Array<string | undefined>) => { const seen = new Set<string>(), dup = new Set<string>(); for (const value of values.filter(Boolean) as string[]) seen.has(value) ? dup.add(value) : seen.add(value); return dup.size; };
const range = (values: number[]) => values.length ? { min: Math.min(...values), max: Math.max(...values) } : undefined;

async function main() {
  await mkdir(publicDir, { recursive: true });
  const file = (await readdir(rawDir)).find((name) => name.toLowerCase().endsWith('.csv'));
  if (!file) throw new Error('No sedimentation basin CSV found in data/raw/sedimentation-basin-facilities.');
  const buffer = await readFile(path.join(rawDir, file));
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const text = utf8.includes('POOL_CODE') ? utf8 : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
  const [header, ...rows] = csv(text);
  const headers = header.map((value) => value.trim());
  const issues: Array<{ row: number; issue: string; value?: string }> = [];
  const records = rows.map((values, index): SedimentationBasinFacilityRecord => {
    const row = Object.fromEntries(headers.map((name, column) => [name, values[column]?.trim() || undefined]));
    const customCode = cleanText(row.CUSTOM_CODE) ?? '';
    const poolCode = cleanText(row.POOL_CODE) ?? '';
    const poolName = cleanText(row.POOL_NAME) ?? '';
    const district = parseTaipeiDistrictName(row.TOWN_NAME);
    const x = parseSourceCoordinate(row['X坐標'], 'x'), y = parseSourceCoordinate(row['Y坐標'], 'y');
    const area = parseCatchmentArea(row['集水區面積']);
    for (const warning of [district.warning, x.warning, y.warning, area.warning].filter(Boolean)) issues.push({ row: index + 2, issue: warning!, value: values.join('|') });
    const converted = x.value !== undefined && y.value !== undefined ? convertTwd97Tm2ToWgs84(x.value, y.value) : { status: 'missing' as const, longitude: undefined, latitude: undefined };
    if ('warning' in converted && converted.warning) issues.push({ row: index + 2, issue: converted.warning, value: `${x.raw ?? ''},${y.raw ?? ''}` });
    const coordinateValid = converted.status === 'converted_from_twd97_tm2';
    const pair = coordinateValid ? `${converted.longitude!.toFixed(6)}|${converted.latitude!.toFixed(6)}` : undefined;
    const query = createSedimentationBasinMapQuery({ poolName, districtName: district.districtNameNormalized });
    return {
      id: norm(poolCode) || hash(values.join('|')),
      module: 'sedimentation_basin_facilities',
      customCode,
      customCodeNormalized: norm(customCode),
      poolCode,
      poolCodeNormalized: norm(poolCode),
      poolCodeSequence: numSeq(poolCode),
      poolName,
      poolNameNormalized: norm(poolName),
      districtName: district.districtName ?? '',
      districtNameNormalized: district.districtNameNormalized,
      isTaipeiDistrict: district.isTaipeiDistrict,
      sourceCoordinateX: x.raw ?? '',
      sourceCoordinateY: y.raw ?? '',
      sourceCoordinateXNumber: x.value,
      sourceCoordinateYNumber: y.value,
      sourceCoordinateSystem: 'twd97_tm2_zone_121',
      longitude: converted.longitude,
      latitude: converted.latitude,
      coordinateConversionStatus: converted.status,
      coordinateValid,
      coordinateQuality: coordinateValid ? 'valid_converted_wgs84_taipei' : converted.status === 'outside_taipei_bounds_after_conversion' ? 'outside_taipei_bounds' : converted.status === 'missing' ? 'missing' : 'invalid',
      coordinatePairKey: pair,
      locationPrecision: coordinateValid ? 'converted_source_coordinate' : district.districtNameNormalized && poolName ? 'district_location_description' : district.districtNameNormalized ? 'district_only' : 'missing',
      catchmentAreaRaw: area.catchmentAreaRaw ?? '',
      catchmentArea: area.catchmentArea,
      catchmentAreaCategory: classifySedimentationBasinCatchmentArea(area.catchmentArea),
      googleMapsQuery: query,
      sourceRecordHash: hash(values.join('|')),
      source: '臺北市水利處沉砂池',
      sourceAgency: '臺北市政府工務局水利工程處',
    };
  });
  const totalArea = records.reduce((sum, record) => sum + (record.catchmentArea ?? 0), 0);
  [...records].sort((a, b) => (b.catchmentArea ?? -1) - (a.catchmentArea ?? -1)).forEach((record, index) => { if (record.catchmentArea !== undefined) { record.catchmentAreaRankCitywide = index + 1; record.catchmentAreaShareCitywide = totalArea ? record.catchmentArea / totalArea * 100 : undefined; } });
  const dataQuality = {
    missingCustomCodeCount: records.filter((record) => !record.customCode).length,
    missingPoolCodeCount: records.filter((record) => !record.poolCode).length,
    duplicatePoolCodeCount: duplicateCount(records.map((record) => record.poolCodeNormalized)),
    missingPoolNameCount: records.filter((record) => !record.poolName).length,
    duplicatePoolNameCount: duplicateCount(records.map((record) => record.poolNameNormalized)),
    missingDistrictCount: records.filter((record) => !record.districtName).length,
    unknownDistrictCount: records.filter((record) => !record.isTaipeiDistrict).length,
    missingSourceCoordinateXCount: records.filter((record) => !record.sourceCoordinateX).length,
    missingSourceCoordinateYCount: records.filter((record) => !record.sourceCoordinateY).length,
    invalidSourceCoordinateCount: records.filter((record) => record.coordinateQuality === 'invalid').length,
    coordinateConversionFailedCount: records.filter((record) => record.coordinateConversionStatus === 'conversion_failed').length,
    outsideTaipeiBoundsAfterConversionCount: records.filter((record) => record.coordinateConversionStatus === 'outside_taipei_bounds_after_conversion').length,
    missingCatchmentAreaCount: records.filter((record) => !record.catchmentAreaRaw).length,
    invalidCatchmentAreaCount: issues.filter((issue) => issue.issue.startsWith('Invalid catchment area')).length,
    zeroCatchmentAreaCount: records.filter((record) => record.catchmentArea === 0).length,
    duplicateCoordinatePairCount: duplicateCount(records.map((record) => record.coordinatePairKey)),
    duplicateFallbackKeyCount: duplicateCount(records.map((record) => `${record.customCodeNormalized}|${record.poolCodeNormalized}|${record.poolNameNormalized}|${record.districtNameNormalized}`)),
  };
  const summary = buildSedimentationBasinFacilitySummary(records, dataQuality);
  const xs = records.flatMap((record) => record.sourceCoordinateXNumber === undefined ? [] : [record.sourceCoordinateXNumber]);
  const ys = records.flatMap((record) => record.sourceCoordinateYNumber === undefined ? [] : [record.sourceCoordinateYNumber]);
  const lngs = records.flatMap((record) => record.longitude === undefined ? [] : [record.longitude]);
  const lats = records.flatMap((record) => record.latitude === undefined ? [] : [record.latitude]);
  const report = { generatedAt: new Date().toISOString(), source: '臺北市水利處沉砂池', sourceAgency: '工務局水利處', file, encoding: utf8.includes('POOL_CODE') ? 'UTF-8-SIG' : 'Big5/CP950', inputRows: rows.length, outputRows: records.length, sourceCoordinateSystem: 'TWD97-TM2 zone 121 / EPSG:3826', sourceCoordinateRange: { x: range(xs), y: range(ys) }, convertedCoordinateRange: { longitude: range(lngs), latitude: range(lats) }, dataQuality, issues: issues.slice(0, 200), notes: ['Source X/Y are projected coordinates and are converted to WGS84 before map display.', 'Points are reference locations, not facility boundaries, entrances, or public-access guidance.'] };
  await writeFile(path.join(publicDir, 'sedimentation-basin-facilities.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'sedimentation-basin-facility-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'sedimentation-basin-facility-conversion-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Converted ${records.length} sedimentation basin record(s).`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
