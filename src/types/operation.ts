export type OperationParameterKey =
  | 'dailyAverageWaterLevelM'
  | 'effectiveStorageMillionM3'
  | 'catchmentAverageRainfallMm'
  | 'reservoirInflowM3'
  | 'reservoirOutflowM3'
  | 'inflowMinusOutflowM3'
  | 'nanshiRiverFlowM3'
  | 'combinedRawWaterM3';

export type OperationValue = {
  raw: string;
  value: number | null;
  qualifier: 'measured' | 'missing';
};

export type OperationDailyRecord = {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  weekday: number;
  period: string;
  values: Record<OperationParameterKey, OperationValue>;
  sourceResource: string;
};

export type OperationMonthlySummary = {
  period: string;
  year: number;
  month: number;
  dayCount: number;
  avgWaterLevelM: number | null;
  minWaterLevelM: number | null;
  maxWaterLevelM: number | null;
  avgEffectiveStorageMillionM3: number | null;
  minEffectiveStorageMillionM3: number | null;
  maxEffectiveStorageMillionM3: number | null;
  totalCatchmentRainfallMm: number | null;
  totalReservoirInflowM3: number | null;
  totalReservoirOutflowM3: number | null;
  totalInflowMinusOutflowM3: number | null;
  totalNanshiRiverFlowM3: number | null;
  totalCombinedRawWaterM3: number | null;
  highestDailyRainfallMm: number | null;
  lowestWaterLevelM: number | null;
};

export type OperationParameterSeriesPoint = {
  date: string;
  period: string;
  parameter: OperationParameterKey;
  value: number | null;
};
