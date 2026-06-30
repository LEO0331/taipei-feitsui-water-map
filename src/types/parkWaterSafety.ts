export type ParkWaterSafetyFacilityCategory =
  | 'water_safety_sign'
  | 'lifebuoy'
  | 'lifesaving_equipment'
  | 'rescue_rope'
  | 'rescue_pole'
  | 'combined_sign_and_equipment'
  | 'other'
  | 'unknown';

export type CoordinateStatus = 'valid' | 'missing' | 'outlier' | 'unparsed';
export type CoordinateSystem = 'wgs84' | 'twd97' | 'unknown';

export type ParkWaterSafetyEquipmentRecord = {
  id: string;
  module: 'park_water_safety_equipment';
  resourceName: string;
  district?: string;
  districtNormalized?: string;
  parkName?: string;
  locationDescription?: string;
  facilityNameRaw?: string;
  facilityNameNormalized?: string;
  facilityCategory: ParkWaterSafetyFacilityCategory;
  equipmentCode?: string;
  equipmentCodeNormalized?: string;
  sourceX?: string;
  sourceY?: string;
  sourceCoordinateSystem: CoordinateSystem;
  coordinateStatus: CoordinateStatus;
  hasCoordinates: boolean;
  longitude?: number;
  latitude?: number;
  sourceRecordHash: string;
  source: string;
  sourceAgency: string;
};

export type ParkWaterSafetyEquipmentSummary = {
  totalRecords: number;
  districtCount: number;
  parkCount: number;
  equipmentCodeCount: number;
  recordsWithValidCoordinates: number;
  recordsWithMissingCoordinates: number;
  recordsWithOutlierCoordinates: number;
  recordsWithUnparsedCoordinates: number;
  byDistrict: Array<{ district: string; recordCount: number; validCoordinateCount: number; facilityCategoryBreakdown: Array<{ facilityCategory: ParkWaterSafetyFacilityCategory; count: number }> }>;
  byFacilityCategory: Array<{ facilityCategory: ParkWaterSafetyFacilityCategory; count: number }>;
  byParkName: Array<{ parkName: string; recordCount: number; district?: string }>;
  byResourceName: Array<{ resourceName: string; count: number }>;
  coordinateQuality: { valid: number; missing: number; outlier: number; unparsed: number };
};
