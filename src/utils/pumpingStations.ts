import proj4 from 'proj4';
import type { CoordinateStatus, PumpingStation, PumpingStationSummary } from '../types/pumpingStations';

proj4.defs('EPSG:3826', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs');
const districts = new Set(['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']);

export function deriveDecade(year: number | undefined) { return year === undefined ? undefined : `${Math.floor(year / 10) * 10}s`; }
export function parseEstablishedDate(raw: unknown) {
  const establishedDateRaw = String(raw ?? '').trim() || undefined;
  const match = establishedDateRaw?.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return { establishedDateRaw };
  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() + 1 !== Number(month) || parsed.getUTCDate() !== Number(day)) return { establishedDateRaw, warning: 'Invalid Gregorian YYYYMMDD date' };
  return { establishedDateRaw, establishedDate: `${year}-${month}-${day}`, establishedYear: Number(year), establishedDecade: deriveDecade(Number(year)) };
}
export function parseManagementDistrictNumber(raw: unknown) {
  const match = String(raw ?? '').match(/第([一二三四五六])分區/);
  return match ? '一二三四五六'.indexOf(match[1]) + 1 : undefined;
}
export function normalizeTaipeiDistrict(raw: unknown) { const value = String(raw ?? '').trim(); return districts.has(value) ? value : undefined; }
export function normalizeRiverSystem(raw: unknown) { return String(raw ?? '').trim() || undefined; }
export function convertTwd97ToWgs84(x: number, y: number) { const [longitude, latitude] = proj4('EPSG:3826', 'EPSG:4326', [x, y]); return { longitude, latitude }; }
export function coordinateStatus(x: number | undefined, y: number | undefined): CoordinateStatus {
  if (x === undefined || y === undefined) return 'missing';
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 'unparsed';
  const { longitude, latitude } = convertTwd97ToWgs84(x, y);
  return longitude >= 121.43 && longitude <= 121.70 && latitude >= 24.90 && latitude <= 25.25 ? 'valid' : 'outlier';
}
const counts = (values: Array<string | undefined>) => [...new Map(values.filter((value): value is string => Boolean(value)).map((value) => [value, 0])).keys()];
const grouped = (values: Array<string | undefined>) => [...new Map(values.filter((value): value is string => Boolean(value)).map((value) => [value, 0])).keys()];
const summaryCounts = (values: Array<string | undefined>) => [...new Map(values.filter((value): value is string => Boolean(value)).map((value) => [value, values.filter((other) => other === value).length])).entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hant'));
export function buildPumpingStationSummary(records: PumpingStation[]): PumpingStationSummary {
  const valid = records.filter((record) => record.coordinateStatus === 'valid').length;
  const byDistrict = summaryCounts(records.map((record) => record.districtNormalized)).map(({ name: district, count }) => ({ district, count, riverSystems: summaryCounts(records.filter((record) => record.districtNormalized === district).map((record) => record.riverSystemNormalized)).map(({ name: riverSystem, count }) => ({ riverSystem, count })), managementUnits: summaryCounts(records.filter((record) => record.districtNormalized === district).map((record) => record.managementUnit)).map(({ name: managementUnit, count }) => ({ managementUnit, count })) }));
  const byRiverSystem = summaryCounts(records.map((record) => record.riverSystemNormalized)).map(({ name: riverSystem, count }) => ({ riverSystem, count, districts: summaryCounts(records.filter((record) => record.riverSystemNormalized === riverSystem).map((record) => record.districtNormalized)).map(({ name: district, count }) => ({ district, count })) }));
  const years = records.flatMap((record) => record.establishedYear === undefined ? [] : [record.establishedYear]);
  return { totalRecords: records.length, validCoordinateCount: valid, missingCoordinateCount: records.filter((record) => record.coordinateStatus === 'missing').length, outlierCoordinateCount: records.filter((record) => record.coordinateStatus === 'outlier').length, unparsedCoordinateCount: records.filter((record) => record.coordinateStatus === 'unparsed').length, districtCount: counts(records.map((record) => record.districtNormalized)).length, riverSystemCount: counts(records.map((record) => record.riverSystemNormalized)).length, managementUnitCount: counts(records.map((record) => record.managementUnit)).length, minEstablishedDate: records.map((record) => record.establishedDate).filter(Boolean).sort()[0], maxEstablishedDate: records.map((record) => record.establishedDate).filter(Boolean).sort().at(-1), byDistrict, byRiverSystem, byManagementUnit: summaryCounts(records.map((record) => record.managementUnit)).map(({ name: managementUnit, count }) => ({ managementUnit, count })), byEstablishedYear: summaryCounts(years.map(String)).map(({ name, count }) => ({ year: Number(name), count })), byEstablishedDecade: summaryCounts(records.map((record) => record.establishedDecade)).map(({ name: decade, count }) => ({ decade, count })) };
}
