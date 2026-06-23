export type WaterDataModule = 'feitsui_reservoir' | 'river_water_quality';

export type WaterValueQualifier =
  | 'measured'
  | 'not_detected_below'
  | 'not_measured'
  | 'missing'
  | 'unparsed';

export type RiverWaterQualityValue = {
  raw?: string;
  value?: number;
  qualifier: WaterValueQualifier;
  detectionLimit?: number;
  unit?: string;
};

export const riverIndicatorKeys = [
  'waterTemperatureC',
  'airTemperatureC',
  'ph',
  'dissolvedOxygenMgL',
  'biochemicalOxygenDemandMgL',
  'ammoniaNitrogenMgL',
  'nitrateNitrogenMgL',
  'nitriteNitrogenMgL',
  'suspendedSolidsMgL',
  'chemicalOxygenDemandMgL',
  'cadmiumUgL',
  'chromiumUgL',
  'copperUgL',
  'leadUgL',
  'zincUgL',
  'ironUgL',
  'manganeseUgL',
  'silverUgL',
  'nickelUgL',
  'mercuryUgL',
  'arsenicUgL',
  'conductivityUmhoCm',
  'totalPhosphorusMgL',
  'turbidityNtu',
  'coliformCfuPer100Ml',
  'chlorideMgL',
  'totalNitrogenMgL',
] as const;

export type RiverIndicatorKey = typeof riverIndicatorKeys[number];

export type RiverWaterQualityRecord = {
  id: string;
  module: 'river_water_quality';
  yearRoc?: number;
  year?: number;
  month: number;
  sequenceNumber?: number;
  riverName: string;
  stationName: string;
  source: string;
} & Record<RiverIndicatorKey, RiverWaterQualityValue>;

export type RiverAggregate = {
  recordCount: number;
  averageDissolvedOxygenMgL?: number;
  averageBiochemicalOxygenDemandMgL?: number;
  averageAmmoniaNitrogenMgL?: number;
  averageSuspendedSolidsMgL?: number;
  averageChemicalOxygenDemandMgL?: number;
  averageTurbidityNtu?: number;
  averageColiformCfuPer100Ml?: number;
};

export type RiverWaterQualitySummary = {
  totalRecords: number;
  years: number[];
  yearRoc?: number;
  year?: number;
  monthCount: number;
  riverCount: number;
  stationCount: number;
  byRiver: Array<RiverAggregate & { riverName: string; stationCount: number }>;
  byStation: Array<RiverAggregate & { riverName: string; stationName: string }>;
  byMonth: Array<RiverAggregate & { year?: number; month: number; period: string }>;
  valueQuality: {
    measuredValueCount: number;
    notDetectedValueCount: number;
    notMeasuredValueCount: number;
    missingValueCount: number;
    unparsedValueCount: number;
  };
};

export type RiverStationLocation = {
  riverName: string;
  stationName: string;
  latitude: number;
  longitude: number;
  sourceNote: string;
};
