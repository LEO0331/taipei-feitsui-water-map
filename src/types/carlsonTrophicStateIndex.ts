export type TrophicStateIndicatorCategory = 'oligotrophic' | 'mesotrophic' | 'eutrophic' | 'hypereutrophic' | 'unknown';
export type CarlsonTrophicStateIndexCategory = 'under_30' | '30_to_40' | '40_to_50' | '50_to_60' | '60_to_70' | 'over_70' | 'missing' | 'unknown';
export type WaterQualityTrendDirection = 'increase' | 'decrease' | 'no_change' | 'first_record' | 'unknown';

export type CarlsonTrophicStateIndexRecord = {
  id: string;
  module: 'carlson_trophic_state_index';
  sourceId?: string;
  agencyName?: string;
  agencyCode?: string;
  rocYear: number;
  year: number;
  yearKey: string;
  periodDate: string;
  ctsiRaw?: string;
  ctsi?: number;
  ctsiCategory: CarlsonTrophicStateIndexCategory;
  trophicStateIndicatorRaw?: string;
  trophicStateIndicatorCategory: TrophicStateIndicatorCategory;
  yearOverYearChange?: number;
  yearOverYearPercentChange?: number;
  trendDirection: WaterQualityTrendDirection;
  rolling3YearAverage?: number;
  isLatestYear: boolean;
  sourceRecordHash: string;
  source: string;
  sourceAgency: string;
};

export type CarlsonTrophicStateIndexSummary = {
  totalRecords: number;
  minYear?: number;
  maxYear?: number;
  minRocYear?: number;
  maxRocYear?: number;
  latestYear?: number;
  latest?: Partial<CarlsonTrophicStateIndexRecord>;
  minCtsi?: { year: number; rocYear: number; value: number };
  maxCtsi?: { year: number; rocYear: number; value: number };
  averageCtsi?: number;
  medianCtsi?: number;
  totalCtsiChange?: number;
  averageAnnualCtsiChange?: number;
  trophicStateIndicatorCounts: Record<TrophicStateIndicatorCategory, number>;
  ctsiCategoryCounts: Record<CarlsonTrophicStateIndexCategory, number>;
  trendDirectionCounts: Record<WaterQualityTrendDirection, number>;
  byYear: Array<{
    year: number;
    rocYear: number;
    ctsi?: number;
    trophicStateIndicatorCategory: TrophicStateIndicatorCategory;
    trendDirection: WaterQualityTrendDirection;
    yearOverYearChange?: number;
    rolling3YearAverage?: number;
  }>;
  dataQuality: {
    invalidYearCount: number;
    missingCtsiCount: number;
    invalidCtsiCount: number;
    duplicateYearCount: number;
    unknownIndicatorCount: number;
  };
};
