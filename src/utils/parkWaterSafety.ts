import proj4 from 'proj4';
import type { CoordinateStatus, CoordinateSystem, ParkWaterSafetyEquipmentRecord, ParkWaterSafetyEquipmentSummary, ParkWaterSafetyFacilityCategory } from '../types/parkWaterSafety';

proj4.defs('EPSG:3826', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs');
export const taipeiDistricts = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'] as const;
const missing = new Set(['', '-', '--', 'nan', 'null']);
const categoryOrder: ParkWaterSafetyFacilityCategory[] = ['water_safety_sign', 'lifebuoy', 'lifesaving_equipment', 'rescue_rope', 'rescue_pole', 'combined_sign_and_equipment', 'other', 'unknown'];

export function cleanText(raw: unknown): string | undefined {
  const value = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(value.toLowerCase()) ? undefined : value;
}

export function classifyParkWaterSafetyFacility(raw: string | undefined): ParkWaterSafetyFacilityCategory {
  const value = raw?.trim() ?? '';
  if (!value) return 'unknown';
  const hasSign = /告示|告示牌|警示|標示/.test(value);
  const hasLifebuoy = value.includes('救生圈');
  const hasEquipment = /救生設備|救生|救援/.test(value);
  const hasRope = value.includes('繩');
  const hasPole = /竿|桿/.test(value);
  if (hasSign && (hasLifebuoy || hasEquipment || hasRope || hasPole)) return 'combined_sign_and_equipment';
  if (hasLifebuoy) return 'lifebuoy';
  if (hasRope) return 'rescue_rope';
  if (hasPole) return 'rescue_pole';
  if (hasEquipment) return 'lifesaving_equipment';
  if (hasSign) return 'water_safety_sign';
  return 'other';
}

export function parseDistrictFromResourceNameOrLocation(resourceName: string, locationDescription?: string): string | undefined {
  return taipeiDistricts.find((district) => resourceName.includes(district) || locationDescription?.includes(district));
}

export function parseParkName(locationDescription?: string, resourceName?: string): string | undefined {
  const text = cleanText(locationDescription) ?? cleanText(resourceName);
  const match = text?.match(/([^，,、\s]*(?:公園|水池|湖|池))/);
  return match?.[1];
}

export function parseParkWaterSafetyCoordinates(rawX: unknown, rawY: unknown): {
  sourceX?: string;
  sourceY?: string;
  longitude?: number;
  latitude?: number;
  sourceCoordinateSystem: CoordinateSystem;
  coordinateStatus: CoordinateStatus;
  warning?: string;
} {
  const sourceX = cleanText(rawX);
  const sourceY = cleanText(rawY);
  if (!sourceX || !sourceY) return { sourceX, sourceY, sourceCoordinateSystem: 'unknown', coordinateStatus: 'missing' };
  const x = Number(sourceX.replace(/,/g, ''));
  const y = Number(sourceY.replace(/,/g, ''));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { sourceX, sourceY, sourceCoordinateSystem: 'unknown', coordinateStatus: 'unparsed', warning: 'Unparsed coordinate' };
  let longitude: number | undefined;
  let latitude: number | undefined;
  let sourceCoordinateSystem: CoordinateSystem = 'unknown';
  if (x >= 121 && x <= 122 && y >= 24 && y <= 26) {
    longitude = x; latitude = y; sourceCoordinateSystem = 'wgs84';
  } else if (x >= 250000 && x <= 320000 && y >= 2750000 && y <= 2785000) {
    [longitude, latitude] = proj4('EPSG:3826', 'EPSG:4326', [x, y]);
    sourceCoordinateSystem = 'twd97';
  } else {
    return { sourceX, sourceY, sourceCoordinateSystem, coordinateStatus: 'outlier', warning: 'Coordinate does not look like Taipei WGS84 or TWD97' };
  }
  const valid = longitude >= 121.30 && longitude <= 121.80 && latitude >= 24.85 && latitude <= 25.30;
  return { sourceX, sourceY, longitude, latitude, sourceCoordinateSystem, coordinateStatus: valid ? 'valid' : 'outlier', warning: valid ? undefined : 'Converted coordinate outside Taipei bounds' };
}

const countBy = <T extends string>(values: T[]) => [...values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<T, number>())].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hant'));

export function buildParkWaterSafetyEquipmentSummary(records: ParkWaterSafetyEquipmentRecord[]): ParkWaterSafetyEquipmentSummary {
  const byCategory = countBy(records.map((record) => record.facilityCategory)).sort((a, b) => categoryOrder.indexOf(a.name) - categoryOrder.indexOf(b.name));
  const byDistrict = countBy(records.map((record) => record.districtNormalized ?? '未知')).map(({ name: district, count }) => {
    const items = records.filter((record) => (record.districtNormalized ?? '未知') === district);
    return { district, recordCount: count, validCoordinateCount: items.filter((record) => record.coordinateStatus === 'valid').length, facilityCategoryBreakdown: countBy(items.map((record) => record.facilityCategory)).map(({ name: facilityCategory, count }) => ({ facilityCategory, count })) };
  });
  return {
    totalRecords: records.length,
    districtCount: new Set(records.map((record) => record.districtNormalized).filter(Boolean)).size,
    parkCount: new Set(records.map((record) => record.parkName).filter(Boolean)).size,
    equipmentCodeCount: new Set(records.map((record) => record.equipmentCodeNormalized).filter(Boolean)).size,
    recordsWithValidCoordinates: records.filter((record) => record.coordinateStatus === 'valid').length,
    recordsWithMissingCoordinates: records.filter((record) => record.coordinateStatus === 'missing').length,
    recordsWithOutlierCoordinates: records.filter((record) => record.coordinateStatus === 'outlier').length,
    recordsWithUnparsedCoordinates: records.filter((record) => record.coordinateStatus === 'unparsed').length,
    byDistrict,
    byFacilityCategory: byCategory.map(({ name: facilityCategory, count }) => ({ facilityCategory, count })),
    byParkName: countBy(records.map((record) => record.parkName).filter((value): value is string => Boolean(value))).map(({ name: parkName, count }) => ({ parkName, recordCount: count, district: records.find((record) => record.parkName === parkName)?.districtNormalized })),
    byResourceName: countBy(records.map((record) => record.resourceName)).map(({ name: resourceName, count }) => ({ resourceName, count })),
    coordinateQuality: {
      valid: records.filter((record) => record.coordinateStatus === 'valid').length,
      missing: records.filter((record) => record.coordinateStatus === 'missing').length,
      outlier: records.filter((record) => record.coordinateStatus === 'outlier').length,
      unparsed: records.filter((record) => record.coordinateStatus === 'unparsed').length,
    },
  };
}
