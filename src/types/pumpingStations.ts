export type CoordinateStatus = 'valid' | 'missing' | 'outlier' | 'unparsed';

export type PumpingStation = {
  id: string;
  type: 'pumping_station';
  sourceSequenceNumber?: number;
  stationName: string;
  riverSystem?: string;
  riverSystemNormalized?: string;
  district?: string;
  districtNormalized?: string;
  establishedDateRaw?: string;
  establishedDate?: string;
  establishedYear?: number;
  establishedDecade?: string;
  stationAgeYears?: number;
  managementUnit?: string;
  managementDistrictNumber?: number;
  xTwd97?: number;
  yTwd97?: number;
  longitude?: number;
  latitude?: number;
  coordinateStatus: CoordinateStatus;
  source: string;
  sourceAgency: string;
};

export type PumpingStationSummary = {
  totalRecords: number;
  validCoordinateCount: number;
  missingCoordinateCount: number;
  outlierCoordinateCount: number;
  unparsedCoordinateCount: number;
  districtCount: number;
  riverSystemCount: number;
  managementUnitCount: number;
  minEstablishedDate?: string;
  maxEstablishedDate?: string;
  byDistrict: Array<{ district: string; count: number; riverSystems: Array<{ riverSystem: string; count: number }>; managementUnits: Array<{ managementUnit: string; count: number }> }>;
  byRiverSystem: Array<{ riverSystem: string; count: number; districts: Array<{ district: string; count: number }> }>;
  byManagementUnit: Array<{ managementUnit: string; count: number }>;
  byEstablishedYear: Array<{ year: number; count: number }>;
  byEstablishedDecade: Array<{ decade: string; count: number }>;
};
