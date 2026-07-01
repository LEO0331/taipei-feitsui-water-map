import type { ClearWaterQualitySiteKey, ClearWaterQualitySiteType, TreatmentPlantClearWaterQualityRecord, TreatmentPlantClearWaterQualitySummary, WaterQualityStandardComparison, WaterQualityStandardLimitType, WaterQualityTestItemCategory } from '../types/clearWaterQuality';

export const CLEAR_WATER_QUALITY_SITES: Record<ClearWaterQualitySiteKey, { siteNameZh: string; siteNameEn: string; sourceColumn: string; siteType: ClearWaterQualitySiteType }> = {
  zhitan_treatment_plant: { siteNameZh: '直潭淨水場', siteNameEn: 'Zhitan Treatment Plant', sourceColumn: '直潭淨水場數值', siteType: 'treatment_plant' },
  changxing_treatment_plant: { siteNameZh: '長興淨水場', siteNameEn: 'Changxing Treatment Plant', sourceColumn: '長興淨水場數值', siteType: 'treatment_plant' },
  gongguan_treatment_plant: { siteNameZh: '公館淨水場', siteNameEn: 'Gongguan Treatment Plant', sourceColumn: '公館淨水場數值', siteType: 'treatment_plant' },
  shuangxi_water_source: { siteNameZh: '雙溪水源', siteNameEn: 'Shuangxi Water Source', sourceColumn: '雙溪水源數值', siteType: 'water_source' },
  shilin_water_source: { siteNameZh: '士林水源', siteNameEn: 'Shilin Water Source', sourceColumn: '士林水源數值', siteType: 'water_source' },
  sanjiaopu: { siteNameZh: '三角埔', siteNameEn: 'Sanjiaopu', sourceColumn: '三角埔數值', siteType: 'water_source' },
  dingbeitou_water_source: { siteNameZh: '頂北投水源', siteNameEn: 'Dingbeitou Water Source', sourceColumn: '頂北投水源數值', siteType: 'water_source' },
  lujiaokeng_clear_water: { siteNameZh: '鹿角坑清', siteNameEn: 'Lujiaokeng Clear Water', sourceColumn: '鹿角坑清數值', siteType: 'clear_water_source' },
};

const missing = new Set(['', '-', '--', 'nan', 'null', '尚無資料']);
const itemKeys: Record<string, string> = { pH值: 'ph', 自由有效餘氯: 'free_residual_chlorine', 總溶解固體量: 'total_dissolved_solids', 總三鹵甲烷: 'total_trihalomethanes', 大腸桿菌群: 'coliform_group', 濁度: 'turbidity', 總硬度: 'total_hardness' };

export function cleanText(raw: unknown): string | undefined {
  const value = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  return missing.has(value.toLowerCase()) ? undefined : value;
}

export function parseIntegerText(raw: unknown): number | undefined {
  const text = cleanText(raw)?.replace(/,/g, '');
  const value = text === undefined ? undefined : Number.parseInt(text, 10);
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function parseNumericValue(raw: unknown): { raw?: string; value?: number; warning?: string } {
  const rawText = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  const text = cleanText(rawText)?.replace(/,/g, '');
  if (text === undefined) return { raw: rawText || undefined };
  const value = Number(text);
  return Number.isFinite(value) ? { raw: rawText, value } : { raw: rawText, warning: `Unparsed numeric value: ${rawText}` };
}

export function parseWaterQualityStandardLimit(raw: unknown): { raw?: string; type: WaterQualityStandardLimitType; lower?: number; upper?: number; display?: string; warning?: string } {
  const rawText = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  const text = cleanText(rawText);
  if (!text) return { raw: rawText || undefined, type: 'none' };
  if (text.includes('~')) {
    const [lowerRaw, upperRaw] = text.split('~');
    const lower = parseNumericValue(lowerRaw).value;
    const upper = parseNumericValue(upperRaw).value;
    return lower !== undefined && upper !== undefined ? { raw: rawText, type: 'range', lower, upper, display: text } : { raw: rawText, type: 'unknown', display: text, warning: `Unparsed range standard: ${rawText}` };
  }
  const numeric = parseNumericValue(text);
  if (numeric.value !== undefined) return { raw: rawText, type: 'upper_bound', upper: numeric.value, display: text };
  return { raw: rawText, type: 'text', display: text, warning: `Text standard: ${rawText}` };
}

export function compareMeasuredValueToStandard(args: { measuredValue?: number; standardLimitType: WaterQualityStandardLimitType; standardLimitLower?: number; standardLimitUpper?: number }): { comparisonToStandard: WaterQualityStandardComparison; standardMargin?: number; standardRatio?: number } {
  const { measuredValue, standardLimitType, standardLimitLower, standardLimitUpper } = args;
  if (measuredValue === undefined) return { comparisonToStandard: 'unknown' };
  if (standardLimitType === 'none') return { comparisonToStandard: 'no_standard' };
  if (standardLimitType === 'text' || standardLimitType === 'unknown') return { comparisonToStandard: 'unparsed' };
  if (standardLimitType === 'upper_bound' && standardLimitUpper !== undefined) return { comparisonToStandard: measuredValue <= standardLimitUpper ? 'within_standard' : 'above_upper_limit', standardMargin: standardLimitUpper - measuredValue, standardRatio: standardLimitUpper === 0 ? undefined : measuredValue / standardLimitUpper };
  if (standardLimitType === 'lower_bound' && standardLimitLower !== undefined) return { comparisonToStandard: measuredValue >= standardLimitLower ? 'within_standard' : 'below_lower_limit', standardMargin: measuredValue - standardLimitLower };
  if (standardLimitType === 'range') {
    if (standardLimitLower !== undefined && measuredValue < standardLimitLower) return { comparisonToStandard: 'below_lower_limit', standardMargin: measuredValue - standardLimitLower };
    if (standardLimitUpper !== undefined && measuredValue > standardLimitUpper) return { comparisonToStandard: 'above_upper_limit', standardMargin: standardLimitUpper - measuredValue, standardRatio: measuredValue / standardLimitUpper };
    return { comparisonToStandard: 'within_standard', standardRatio: standardLimitUpper ? measuredValue / standardLimitUpper : undefined };
  }
  return { comparisonToStandard: 'unparsed' };
}

export function deriveDetectionStatus(args: { measuredValue?: number; methodDetectionLimit?: number }) {
  const isZeroReported = args.measuredValue === 0;
  return { isDetected: args.measuredValue !== undefined && args.measuredValue > 0, isZeroReported, isBelowDetectionLimit: args.methodDetectionLimit === undefined || args.measuredValue === undefined ? undefined : args.measuredValue < args.methodDetectionLimit };
}

const roc = (year: number) => year < 1911 ? year + 1911 : year;
const lastDay = (year: number, month: number) => new Date(year, month, 0).getDate();

export function parseClearWaterQualityPeriod(args: { resourceName?: string; fileName?: string }) {
  const fileMatch = args.fileName?.match(/(\d{2,3})年\s*(\d{1,2})月/);
  const coverageMatch = args.resourceName?.match(/(\d{2,3})\/(\d{1,2})\s*-\s*(\d{2,3})\/(\d{1,2})/);
  const sourcePeriodYear = fileMatch ? roc(Number(fileMatch[1])) : undefined;
  const sourcePeriodMonth = fileMatch ? Number(fileMatch[2]) : undefined;
  const startYear = coverageMatch ? roc(Number(coverageMatch[1])) : undefined;
  const startMonth = coverageMatch ? Number(coverageMatch[2]) : undefined;
  const endYear = coverageMatch ? roc(Number(coverageMatch[3])) : undefined;
  const endMonth = coverageMatch ? Number(coverageMatch[4]) : undefined;
  return {
    sourcePeriodRaw: fileMatch?.[0],
    sourcePeriodYear,
    sourcePeriodMonth,
    sourcePeriodMonthKey: sourcePeriodYear && sourcePeriodMonth ? `${sourcePeriodYear}-${String(sourcePeriodMonth).padStart(2, '0')}` : undefined,
    resourceCoverageStart: startYear && startMonth ? `${startYear}-${String(startMonth).padStart(2, '0')}-01` : undefined,
    resourceCoverageEnd: endYear && endMonth ? `${endYear}-${String(endMonth).padStart(2, '0')}-${lastDay(endYear, endMonth)}` : undefined,
    warning: !fileMatch && !coverageMatch ? 'No source period parsed' : undefined,
  };
}

export function classifyWaterQualityTestItem(raw: string | undefined): WaterQualityTestItemCategory {
  const text = raw?.trim() ?? '';
  if (!text) return 'unknown';
  if (['水溫', '濁度', '色度', '臭度'].some((k) => text.includes(k))) return 'physical';
  if (['總鹼度', 'pH', '氯鹽', '硫酸鹽', '氨氮', '亞硝酸鹽氮', '硝酸鹽氮', '總溶解固體量', '氟鹽', '總硬度', '鈣', '鎂'].some((k) => text.includes(k))) return 'chemical_general';
  if (['自由有效餘氯', '溴酸鹽', '亞氯酸鹽'].some((k) => text.includes(k))) return 'disinfection';
  if (['總菌落數', '大腸桿菌群'].some((k) => text.includes(k))) return 'microbiological';
  if (['總有機碳', '總三鹵甲烷', '鹵乙酸'].some((k) => text.includes(k))) return 'organic';
  if (['鉛', '鋁', '砷', '汞', '鎘', '鉻', '銀', '銅', '鋅', '硒', '銻', '鋇', '鎳', '錳', '鐵'].some((k) => text.includes(k))) return 'metal';
  if (['氯乙烯', '二氯乙烯', '三氯乙烷', '四氯化碳', '苯', '二氯乙烷', '三氯乙烯', '二氯苯', '二氯甲烷', '甲苯', '二甲苯', '四氯乙烯', '酚類', '氰鹽'].some((k) => text.includes(k))) return 'volatile_organic_compound';
  if (['安殺番', '靈丹', '丁基拉草', '2,4-地', '巴拉刈', '納乃得', '加保扶', '滅必蝨', '達馬松', '大利松', '巴拉松', '一品松', '亞素靈'].some((k) => text.includes(k))) return 'pesticide';
  return 'other';
}

export function parseWaterQualityTestItem(raw: unknown) {
  const testItemRaw = String(raw ?? '').replace(/\u3000/g, ' ').trim();
  const testItem = cleanText(testItemRaw);
  const normalized = testItem?.replace(/\s+/g, '');
  const key = normalized ? itemKeys[normalized] ?? normalized.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_') : undefined;
  return { testItemRaw: testItemRaw || undefined, testItem, testItemNormalized: normalized, testItemKey: key, testItemCategory: classifyWaterQualityTestItem(testItem), warning: key ? undefined : 'Missing test item' };
}

export function buildTreatmentPlantClearWaterQualitySummary(records: TreatmentPlantClearWaterQualityRecord[]): TreatmentPlantClearWaterQualitySummary {
  const count = (comparison: WaterQualityStandardComparison) => records.filter((record) => record.comparisonToStandard === comparison).length;
  const values = (items: TreatmentPlantClearWaterQualityRecord[]) => items.map((record) => record.measuredValue).filter((value): value is number => value !== undefined);
  const bySite = Object.entries(CLEAR_WATER_QUALITY_SITES).map(([siteKey, site]) => {
    const items = records.filter((record) => record.siteKey === siteKey);
    return { siteKey: siteKey as ClearWaterQualitySiteKey, siteNameZh: site.siteNameZh, siteNameEn: site.siteNameEn, siteType: site.siteType, recordCount: items.length, withinStandardCount: items.filter((record) => record.comparisonToStandard === 'within_standard').length, aboveUpperLimitCount: items.filter((record) => record.comparisonToStandard === 'above_upper_limit').length, belowLowerLimitCount: items.filter((record) => record.comparisonToStandard === 'below_lower_limit').length, noStandardCount: items.filter((record) => record.comparisonToStandard === 'no_standard').length, detectedCount: items.filter((record) => record.isDetected).length };
  });
  const byTestItem = [...new Map(records.map((record) => [record.testItemKey, record])).values()].map((sample) => {
    const items = records.filter((record) => record.testItemKey === sample.testItemKey);
    const nums = values(items);
    return { testItemKey: sample.testItemKey, testItem: sample.testItem, testItemCategory: sample.testItemCategory, unit: sample.unit, standardLimitDisplay: sample.standardLimitDisplay, minMeasuredValue: nums.length ? Math.min(...nums) : undefined, maxMeasuredValue: nums.length ? Math.max(...nums) : undefined, averageMeasuredValue: nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : undefined, siteCount: new Set(items.map((record) => record.siteKey)).size, aboveUpperLimitCount: items.filter((record) => record.comparisonToStandard === 'above_upper_limit').length, belowLowerLimitCount: items.filter((record) => record.comparisonToStandard === 'below_lower_limit').length };
  });
  const categories = [...new Set(records.map((record) => record.testItemCategory))];
  const keyIndicators = Object.fromEntries(['turbidity', 'ph', 'free_residual_chlorine', 'total_dissolved_solids', 'total_hardness', 'total_trihalomethanes'].map((key) => [key, records.filter((record) => record.testItemKey === key).map((record) => ({ siteKey: record.siteKey, value: record.measuredValue, unit: record.unit, comparisonToStandard: record.comparisonToStandard }))]));
  return {
    totalRecords: records.length,
    sourcePeriodMonthKey: records[0]?.sourcePeriodMonthKey,
    resourceCoverageStart: records[0]?.resourceCoverageStart,
    resourceCoverageEnd: records[0]?.resourceCoverageEnd,
    siteCount: new Set(records.map((record) => record.siteKey)).size,
    testItemCount: new Set(records.map((record) => record.testItemKey)).size,
    testItemCategoryCount: categories.length,
    recordsWithMeasuredValue: records.filter((record) => record.measuredValue !== undefined).length,
    recordsWithStandardLimit: records.filter((record) => record.hasStandardLimit).length,
    recordsWithMethodDetectionLimit: records.filter((record) => record.hasMethodDetectionLimit).length,
    withinStandardCount: count('within_standard'),
    aboveUpperLimitCount: count('above_upper_limit'),
    belowLowerLimitCount: count('below_lower_limit'),
    noStandardCount: count('no_standard'),
    unparsedStandardComparisonCount: count('unparsed'),
    bySite,
    byTestItem,
    byCategory: categories.map((testItemCategory) => {
      const items = records.filter((record) => record.testItemCategory === testItemCategory);
      return { testItemCategory, recordCount: items.length, detectedCount: items.filter((record) => record.isDetected).length, aboveUpperLimitCount: items.filter((record) => record.comparisonToStandard === 'above_upper_limit').length, belowLowerLimitCount: items.filter((record) => record.comparisonToStandard === 'below_lower_limit').length };
    }).sort((a, b) => b.recordCount - a.recordCount),
    keyIndicators,
    dataQuality: { missingMeasuredValueCount: records.filter((record) => !record.measuredValueRaw).length, unparsedMeasuredValueCount: records.filter((record) => record.measuredValueRaw && record.measuredValue === undefined).length, unparsedStandardLimitCount: records.filter((record) => record.standardLimitType === 'unknown' || record.standardLimitType === 'text').length, unparsedDetectionLimitCount: records.filter((record) => record.methodDetectionLimitRaw && record.methodDetectionLimit === undefined).length, unknownSiteColumnCount: 0 },
  };
}
