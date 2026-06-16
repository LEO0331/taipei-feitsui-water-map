export type StationGroup =
  | 'dam_profile'
  | 'reservoir_surface'
  | 'tributary_or_stream'
  | 'downstream'
  | 'summary'
  | 'unknown';

export type CoordinateStatus = 'verified' | 'approximate' | 'missing';

export type MonitoringLocationType =
  | 'water_quality_station'
  | 'weather_station'
  | 'summary';

export type StationLocation = {
  stationName: string;
  latitude: number | null;
  longitude: number | null;
  stationGroup: StationGroup;
  locationType?: MonitoringLocationType;
  isSummaryRow?: boolean;
  coordinateStatus: CoordinateStatus;
};

export type WaterQualityQualifier =
  | 'measured'
  | 'not_detected'
  | 'less_than'
  | 'missing';

export type WaterQualityValue = {
  raw: string;
  value: number | null;
  qualifier: WaterQualityQualifier;
};

export type WaterQualityParameterKey =
  | 'waterLevelM'
  | 'airTemperatureC'
  | 'waterDepthM'
  | 'transparencyM'
  | 'waterTemperatureC'
  | 'turbidityNTU'
  | 'pH'
  | 'ammoniaNitrogenMgL'
  | 'dissolvedOxygenMgL'
  | 'bodMgL'
  | 'codMgL'
  | 'suspendedSolidsMgL'
  | 'conductivityUsCm'
  | 'manganeseMgL'
  | 'coliformCfu100mL'
  | 'totalOrganicCarbonMgL'
  | 'totalPhosphorusUgL'
  | 'chlorophyllAUgL'
  | 'algaeCellsPerML';

export type WaterQualityRecord = {
  id: string;
  year: number;
  rocYear: number;
  month: number;
  period: string;
  stationName: string;
  stationGroup: StationGroup;
  isSummaryRow: boolean;
  sourceFileOrResource: string;
  values: Record<WaterQualityParameterKey, WaterQualityValue>;
};

export type ParameterSeriesPoint = {
  period: string;
  stationName: string;
  parameter: WaterQualityParameterKey;
  value: number | null;
  qualifier: WaterQualityQualifier;
};

export type StationComparisonPoint = {
  stationName: string;
  stationGroup: StationGroup;
  value: number | null;
  qualifier: WaterQualityQualifier;
};

export type SummaryCardKey =
  | 'latestPeriod'
  | 'latestStationCount'
  | 'surfaceAverageTurbidity'
  | 'surfaceAveragePH'
  | 'surfaceAverageDissolvedOxygen'
  | 'highestAlgaeStation'
  | 'highestTotalPhosphorusStation'
  | 'lowestTransparencyStation';

export type WaterQualitySummary = {
  latestPeriod: string;
  periods: string[];
  stationCount: number;
  latestStationCount: number;
  summaryCards: Record<SummaryCardKey, string>;
};

export type Filters = {
  period: string;
  stationGroup: StationGroup | 'all';
  stationName: string;
  parameter: WaterQualityParameterKey;
  search: string;
};
