export type SedimentationBasinCoordinateConversionStatus =
  | 'converted_from_twd97_tm2'
  | 'already_wgs84'
  | 'invalid_source_coordinate'
  | 'outside_taipei_bounds_after_conversion'
  | 'missing'
  | 'conversion_failed'
  | 'unknown';

export type SedimentationBasinCoordinateQuality =
  | 'valid_converted_wgs84_taipei'
  | 'valid_wgs84_taipei'
  | 'outside_taipei_bounds'
  | 'invalid'
  | 'missing';

export type SedimentationBasinLocationPrecision =
  | 'converted_source_coordinate'
  | 'official_wgs84_coordinate'
  | 'district_location_description'
  | 'district_only'
  | 'missing';

export type SedimentationBasinCatchmentAreaCategory =
  | 'zero_or_not_reported'
  | 'small'
  | 'medium'
  | 'large'
  | 'very_large'
  | 'unknown';

export type SedimentationBasinFacilityRecord = {
  id: string;
  module: 'sedimentation_basin_facilities';
  customCode: string;
  customCodeNormalized?: string;
  poolCode: string;
  poolCodeNormalized?: string;
  poolCodeSequence?: number;
  poolName: string;
  poolNameNormalized?: string;
  districtName: string;
  districtNameNormalized?: string;
  isTaipeiDistrict: boolean;
  sourceCoordinateX: string;
  sourceCoordinateY: string;
  sourceCoordinateXNumber?: number;
  sourceCoordinateYNumber?: number;
  sourceCoordinateSystem: 'twd97_tm2_zone_121' | 'wgs84' | 'unknown';
  longitude?: number;
  latitude?: number;
  coordinateConversionStatus: SedimentationBasinCoordinateConversionStatus;
  coordinateValid: boolean;
  coordinateQuality: SedimentationBasinCoordinateQuality;
  coordinatePairKey?: string;
  locationPrecision: SedimentationBasinLocationPrecision;
  catchmentAreaRaw: string;
  catchmentArea?: number;
  catchmentAreaCategory: SedimentationBasinCatchmentAreaCategory;
  catchmentAreaRankCitywide?: number;
  catchmentAreaShareCitywide?: number;
  googleMapsQuery?: string;
  sourceRecordHash: string;
  source: string;
  sourceAgency: string;
};

export type SedimentationBasinFacilitySummary = {
  totalRecords: number;
  districtCount: number;
  uniquePoolCodeCount: number;
  uniquePoolNameCount: number;
  uniqueCustomCodeCount: number;
  uniqueCoordinatePairCount: number;
  recordsWithValidConvertedCoordinates: number;
  recordsWithInvalidCoordinates: number;
  duplicateCoordinatePairCount: number;
  totalCatchmentArea?: number;
  minCatchmentArea?: number;
  maxCatchmentArea?: number;
  averageCatchmentArea?: number;
  medianCatchmentArea?: number;
  zeroCatchmentAreaCount: number;
  byDistrict: Array<{ districtName: string; count: number; totalCatchmentArea?: number; averageCatchmentArea?: number; maxCatchmentArea?: number; validCoordinateCount: number }>;
  byCatchmentAreaCategory: Array<{ catchmentAreaCategory: SedimentationBasinCatchmentAreaCategory; count: number; totalCatchmentArea?: number }>;
  topBasinsByCatchmentArea: Array<{ poolCode: string; poolName: string; districtName: string; catchmentArea: number }>;
  coordinateQuality: { validConvertedWgs84Taipei: number; validWgs84Taipei: number; outsideTaipeiBounds: number; invalid: number; missing: number; duplicateCoordinatePairCount: number };
  dataQuality: Record<string, number>;
};
