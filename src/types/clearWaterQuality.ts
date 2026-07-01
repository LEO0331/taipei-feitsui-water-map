export type ClearWaterQualitySiteType = 'treatment_plant' | 'water_source' | 'clear_water_source' | 'unknown';
export type ClearWaterQualitySiteKey =
  | 'zhitan_treatment_plant'
  | 'changxing_treatment_plant'
  | 'gongguan_treatment_plant'
  | 'shuangxi_water_source'
  | 'shilin_water_source'
  | 'sanjiaopu'
  | 'dingbeitou_water_source'
  | 'lujiaokeng_clear_water';

export type WaterQualityTestItemCategory = 'physical' | 'chemical_general' | 'disinfection' | 'microbiological' | 'organic' | 'metal' | 'volatile_organic_compound' | 'pesticide' | 'other' | 'unknown';
export type WaterQualityStandardLimitType = 'none' | 'upper_bound' | 'lower_bound' | 'range' | 'text' | 'unknown';
export type WaterQualityStandardComparison = 'within_standard' | 'above_upper_limit' | 'below_lower_limit' | 'no_standard' | 'unparsed' | 'unknown';

export type TreatmentPlantClearWaterQualityRecord = {
  id: string;
  module: 'tap_water_treatment_plant_clear_water_quality';
  resourceName?: string;
  sourceFileName?: string;
  sourcePeriodRaw?: string;
  sourcePeriodYear?: number;
  sourcePeriodMonth?: number;
  sourcePeriodMonthKey?: string;
  resourceCoverageStart?: string;
  resourceCoverageEnd?: string;
  sourceSequenceNumber?: number;
  testItemRaw: string;
  testItem: string;
  testItemNormalized?: string;
  testItemKey: string;
  testItemCategory: WaterQualityTestItemCategory;
  unit?: string;
  unitNormalized?: string;
  standardLimitRaw?: string;
  standardLimitType: WaterQualityStandardLimitType;
  standardLimitLower?: number;
  standardLimitUpper?: number;
  standardLimitDisplay?: string;
  hasStandardLimit: boolean;
  methodDetectionLimitRaw?: string;
  methodDetectionLimit?: number;
  hasMethodDetectionLimit: boolean;
  siteKey: ClearWaterQualitySiteKey;
  siteNameZh: string;
  siteNameEn: string;
  siteType: ClearWaterQualitySiteType;
  measuredValueRaw?: string;
  measuredValue?: number;
  isDetected: boolean;
  isZeroReported: boolean;
  isBelowDetectionLimit?: boolean;
  comparisonToStandard: WaterQualityStandardComparison;
  standardMargin?: number;
  standardRatio?: number;
  sourceRecordHash: string;
  source: string;
  sourceAgency: string;
};

export type TreatmentPlantClearWaterQualitySummary = {
  totalRecords: number;
  sourcePeriodMonthKey?: string;
  resourceCoverageStart?: string;
  resourceCoverageEnd?: string;
  siteCount: number;
  testItemCount: number;
  testItemCategoryCount: number;
  recordsWithMeasuredValue: number;
  recordsWithStandardLimit: number;
  recordsWithMethodDetectionLimit: number;
  withinStandardCount: number;
  aboveUpperLimitCount: number;
  belowLowerLimitCount: number;
  noStandardCount: number;
  unparsedStandardComparisonCount: number;
  bySite: Array<{ siteKey: ClearWaterQualitySiteKey; siteNameZh: string; siteNameEn: string; siteType: ClearWaterQualitySiteType; recordCount: number; withinStandardCount: number; aboveUpperLimitCount: number; belowLowerLimitCount: number; noStandardCount: number; detectedCount: number }>;
  byTestItem: Array<{ testItemKey: string; testItem: string; testItemCategory: WaterQualityTestItemCategory; unit?: string; standardLimitDisplay?: string; minMeasuredValue?: number; maxMeasuredValue?: number; averageMeasuredValue?: number; siteCount: number; aboveUpperLimitCount: number; belowLowerLimitCount: number }>;
  byCategory: Array<{ testItemCategory: WaterQualityTestItemCategory; recordCount: number; detectedCount: number; aboveUpperLimitCount: number; belowLowerLimitCount: number }>;
  keyIndicators: Record<string, Array<{ siteKey: ClearWaterQualitySiteKey; value?: number; unit?: string; comparisonToStandard: WaterQualityStandardComparison }>>;
  dataQuality: { missingMeasuredValueCount: number; unparsedMeasuredValueCount: number; unparsedStandardLimitCount: number; unparsedDetectionLimitCount: number; unknownSiteColumnCount: number };
};
