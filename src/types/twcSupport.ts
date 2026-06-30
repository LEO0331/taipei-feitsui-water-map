export type TaiwanWaterSupportDestination = 'first_district_office' | 'twelfth_district_office';

export type TaipeiWaterSupportTwcMonthlyRecord = {
  id: string;
  module: 'taipei_water_support_twc_monthly_statistics';
  sourceSequenceNumber?: number;
  dateRaw?: string;
  date?: string;
  year?: number;
  month?: number;
  monthKey?: string;
  quarter?: string;
  rocYear?: number;
  dataYear?: number;
  totalSupportVolume?: number;
  firstDistrictOfficeSupportVolume?: number;
  twelfthDistrictOfficeSupportVolume?: number;
  supportVolumeUnit: 'raw' | 'm3' | 'unknown';
  firstDistrictOfficeSharePercent?: number;
  twelfthDistrictOfficeSharePercent?: number;
  monthOverMonthTotalChange?: number;
  monthOverMonthTotalChangePercent?: number;
  yearOverYearTotalChange?: number;
  yearOverYearTotalChangePercent?: number;
  rolling12MonthTotalSupportVolume?: number;
  isLatestMonth: boolean;
  source: string;
  sourceAgency: string;
};

export type TaipeiWaterSupportTwcAnnualSummary = {
  year: number;
  recordCount: number;
  totalSupportVolume?: number;
  firstDistrictOfficeSupportVolume?: number;
  twelfthDistrictOfficeSupportVolume?: number;
  firstDistrictOfficeSharePercent?: number;
  twelfthDistrictOfficeSharePercent?: number;
  monthlyAverageTotalSupportVolume?: number;
  maxMonthlyTotalSupportVolume?: number;
  maxMonthlyTotalSupportVolumeMonth?: string;
  minMonthlyTotalSupportVolume?: number;
  minMonthlyTotalSupportVolumeMonth?: string;
};

export type TaipeiWaterSupportTwcSummary = {
  totalRecords: number;
  minDate?: string;
  maxDate?: string;
  minYear?: number;
  maxYear?: number;
  latestMonth?: string;
  supportVolumeUnit: 'raw' | 'm3' | 'unknown';
  totalSupportVolume?: number;
  totalFirstDistrictOfficeSupportVolume?: number;
  totalTwelfthDistrictOfficeSupportVolume?: number;
  latestRecord?: TaipeiWaterSupportTwcMonthlyRecord;
  byYear: TaipeiWaterSupportTwcAnnualSummary[];
  byMonth: Array<{ month: number; recordCount: number; totalSupportVolume?: number; monthlyAverageTotalSupportVolume?: number }>;
  destinationBreakdown: Array<{ destination: TaiwanWaterSupportDestination; labelZh: string; labelEn: string; totalSupportVolume?: number; sharePercent?: number }>;
  highestMonthlySupportVolume?: { monthKey: string; totalSupportVolume?: number };
  lowestMonthlySupportVolume?: { monthKey: string; totalSupportVolume?: number };
};
