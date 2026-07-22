export type ReservoirSedimentationSurveyRecord = {
  id: string;
  surveyPeriodRaw: string;
  surveySequence: number | null;
  dateRangeRaw: string;
  startYear: number | null;
  startMonth: number | null;
  endYear: number | null;
  endMonth: number | null;
  endPeriod: string | null;
  endDate: string | null;
  intervalYears: number | null;
  cumulativeIntervalYears: number | null;
  remainingStorageCapacityCubicMeters: number | null;
  sedimentationVolumeCubicMeters: number | null;
  cumulativeSedimentationVolumeCubicMeters: number | null;
  cumulativeAverageAnnualSedimentationCubicMeters: number | null;
  cumulativeSedimentationRatePercent: number | null;
  sourceValues: Record<string, string>;
  warnings: string[];
};

export type ReservoirSedimentationSurveySummary = {
  totalRecords: number;
  latest?: ReservoirSedimentationSurveyRecord;
  minYear?: number;
  maxYear?: number;
  dataQualityWarningCount: number;
};
