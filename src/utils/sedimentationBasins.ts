import proj4 from 'proj4';
import type { SedimentationBasinCatchmentAreaCategory, SedimentationBasinFacilityRecord, SedimentationBasinFacilitySummary } from '../types/sedimentationBasins';

proj4.defs('EPSG:3826', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs');

const districts = new Set(['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']);
const missing = new Set(['', '-', '--', 'nan', 'null', '尚無資料']);
const areaCategories: SedimentationBasinCatchmentAreaCategory[] = ['zero_or_not_reported', 'small', 'medium', 'large', 'very_large', 'unknown'];

export function cleanText(raw: unknown) {
  const text = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(text.toLowerCase()) ? undefined : text;
}

export function parseTaipeiDistrictName(raw: unknown) {
  const districtName = cleanText(raw);
  const districtNameNormalized = districtName?.replace(/台/g, '臺');
  return { districtName, districtNameNormalized, isTaipeiDistrict: !!districtNameNormalized && districts.has(districtNameNormalized), warning: districtNameNormalized && !districts.has(districtNameNormalized) ? `Unknown district: ${districtNameNormalized}` : undefined };
}

export function parseSourceCoordinate(raw: unknown, axis: 'x' | 'y') {
  const text = cleanText(raw);
  if (!text) return { warning: `Missing ${axis} coordinate` };
  const value = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(value)) return { raw: text, warning: `Invalid ${axis} coordinate: ${text}` };
  return { raw: text, value };
}

export function convertTwd97Tm2ToWgs84(x: number, y: number) {
  try {
    const [longitude, latitude] = proj4('EPSG:3826', 'EPSG:4326', [x, y]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return { status: 'conversion_failed' as const, warning: 'Converted coordinate is not finite' };
    if (longitude < 121.3 || longitude > 121.8 || latitude < 24.85 || latitude > 25.3) return { longitude, latitude, status: 'outside_taipei_bounds_after_conversion' as const, warning: 'Converted coordinate is outside Taipei-nearby bounds' };
    return { longitude, latitude, status: 'converted_from_twd97_tm2' as const };
  } catch (error) {
    return { status: 'conversion_failed' as const, warning: String(error) };
  }
}

export function parseCatchmentArea(raw: unknown) {
  const text = cleanText(raw);
  if (!text) return { warning: 'Missing catchment area' };
  const catchmentArea = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(catchmentArea) || catchmentArea < 0) return { catchmentAreaRaw: text, warning: `Invalid catchment area: ${text}` };
  return { catchmentAreaRaw: text, catchmentArea };
}

export function classifySedimentationBasinCatchmentArea(value: number | undefined): SedimentationBasinCatchmentAreaCategory {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value <= 0) return 'zero_or_not_reported';
  if (value < 200) return 'small';
  if (value < 1000) return 'medium';
  if (value < 5000) return 'large';
  return 'very_large';
}

export function createSedimentationBasinMapQuery(record: { poolName?: string; districtName?: string }) {
  return cleanText(`臺北市 ${record.districtName ?? ''} ${record.poolName ?? ''}`);
}

const avg = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length ? (sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2) : undefined; };
const unique = (values: Array<string | undefined>) => new Set(values.filter(Boolean)).size;
const counts = <T extends string>(keys: T[], records: SedimentationBasinFacilityRecord[], pick: (record: SedimentationBasinFacilityRecord) => T) => keys.map((key) => ({ key, items: records.filter((record) => pick(record) === key) }));

export function buildSedimentationBasinFacilitySummary(records: SedimentationBasinFacilityRecord[], dataQuality: Record<string, number> = {}): SedimentationBasinFacilitySummary {
  const areas = records.flatMap((record) => record.catchmentArea === undefined ? [] : [record.catchmentArea]);
  const pairs = records.map((record) => record.coordinatePairKey).filter(Boolean);
  const byDistrict = [...new Set(records.map((record) => record.districtNameNormalized).filter(Boolean))].map((districtName) => {
    const items = records.filter((record) => record.districtNameNormalized === districtName);
    const districtAreas = items.flatMap((record) => record.catchmentArea === undefined ? [] : [record.catchmentArea]);
    return { districtName: districtName!, count: items.length, totalCatchmentArea: districtAreas.reduce((sum, value) => sum + value, 0), averageCatchmentArea: avg(districtAreas), maxCatchmentArea: districtAreas.length ? Math.max(...districtAreas) : undefined, validCoordinateCount: items.filter((record) => record.coordinateValid).length };
  }).sort((a, b) => b.count - a.count || a.districtName.localeCompare(b.districtName, 'zh-Hant'));
  return {
    totalRecords: records.length,
    districtCount: unique(records.map((record) => record.districtNameNormalized)),
    uniquePoolCodeCount: unique(records.map((record) => record.poolCodeNormalized)),
    uniquePoolNameCount: unique(records.map((record) => record.poolNameNormalized)),
    uniqueCustomCodeCount: unique(records.map((record) => record.customCodeNormalized)),
    uniqueCoordinatePairCount: unique(records.map((record) => record.coordinatePairKey)),
    recordsWithValidConvertedCoordinates: records.filter((record) => record.coordinateConversionStatus === 'converted_from_twd97_tm2').length,
    recordsWithInvalidCoordinates: records.filter((record) => !record.coordinateValid).length,
    duplicateCoordinatePairCount: pairs.length - new Set(pairs).size,
    totalCatchmentArea: areas.reduce((sum, value) => sum + value, 0),
    minCatchmentArea: areas.length ? Math.min(...areas) : undefined,
    maxCatchmentArea: areas.length ? Math.max(...areas) : undefined,
    averageCatchmentArea: avg(areas),
    medianCatchmentArea: median(areas),
    zeroCatchmentAreaCount: records.filter((record) => record.catchmentArea === 0).length,
    byDistrict,
    byCatchmentAreaCategory: counts(areaCategories, records, (record) => record.catchmentAreaCategory).map(({ key, items }) => ({ catchmentAreaCategory: key, count: items.length, totalCatchmentArea: items.reduce((sum, record) => sum + (record.catchmentArea ?? 0), 0) })),
    topBasinsByCatchmentArea: [...records].filter((record) => record.catchmentArea !== undefined).sort((a, b) => (b.catchmentArea ?? 0) - (a.catchmentArea ?? 0)).slice(0, 20).map((record) => ({ poolCode: record.poolCode, poolName: record.poolName, districtName: record.districtNameNormalized ?? record.districtName, catchmentArea: record.catchmentArea! })),
    coordinateQuality: {
      validConvertedWgs84Taipei: records.filter((record) => record.coordinateQuality === 'valid_converted_wgs84_taipei').length,
      validWgs84Taipei: records.filter((record) => record.coordinateQuality === 'valid_wgs84_taipei').length,
      outsideTaipeiBounds: records.filter((record) => record.coordinateQuality === 'outside_taipei_bounds').length,
      invalid: records.filter((record) => record.coordinateQuality === 'invalid').length,
      missing: records.filter((record) => record.coordinateQuality === 'missing').length,
      duplicateCoordinatePairCount: pairs.length - new Set(pairs).size,
    },
    dataQuality,
  };
}
