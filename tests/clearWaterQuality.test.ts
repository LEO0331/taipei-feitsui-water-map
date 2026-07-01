import assert from 'node:assert/strict';
import test from 'node:test';
import { compareMeasuredValueToStandard, deriveDetectionStatus, parseClearWaterQualityPeriod, parseNumericValue, parseWaterQualityStandardLimit, parseWaterQualityTestItem } from '../src/utils/clearWaterQuality';

test('clear-water period parser converts ROC filename and resource coverage', () => {
  const period = parseClearWaterQualityPeriod({
    fileName: '臺北自來水事業處各淨水場清水水質（115年4月）1.csv',
    resourceName: '臺北自來水事業處各淨水場清水水質114/5-115/4',
  });
  assert.equal(period.sourcePeriodMonthKey, '2026-04');
  assert.equal(period.resourceCoverageStart, '2025-05-01');
  assert.equal(period.resourceCoverageEnd, '2026-04-30');
});

test('clear-water numeric and standard parsers preserve missing values', () => {
  assert.deepEqual(parseNumericValue('--'), { raw: '--' });
  assert.equal(parseNumericValue('0').value, 0);
  assert.deepEqual(parseWaterQualityStandardLimit('-'), { raw: '-', type: 'none' });
  assert.deepEqual(parseWaterQualityStandardLimit('6.0~8.5'), { raw: '6.0~8.5', type: 'range', lower: 6, upper: 8.5, display: '6.0~8.5' });
  assert.deepEqual(parseWaterQualityStandardLimit('2'), { raw: '2', type: 'upper_bound', upper: 2, display: '2' });
});

test('clear-water comparison handles upper bounds and ranges without safety claims', () => {
  assert.equal(compareMeasuredValueToStandard({ measuredValue: 0.1, standardLimitType: 'upper_bound', standardLimitUpper: 2 }).comparisonToStandard, 'within_standard');
  assert.equal(compareMeasuredValueToStandard({ measuredValue: 9, standardLimitType: 'range', standardLimitLower: 6, standardLimitUpper: 8.5 }).comparisonToStandard, 'above_upper_limit');
  assert.equal(compareMeasuredValueToStandard({ measuredValue: 5, standardLimitType: 'range', standardLimitLower: 6, standardLimitUpper: 8.5 }).comparisonToStandard, 'below_lower_limit');
  assert.equal(compareMeasuredValueToStandard({ measuredValue: 1, standardLimitType: 'none' }).comparisonToStandard, 'no_standard');
});

test('clear-water test item parser creates stable keys and categories', () => {
  assert.equal(parseWaterQualityTestItem('pH值').testItemKey, 'ph');
  assert.equal(parseWaterQualityTestItem('自由有效餘氯').testItemKey, 'free_residual_chlorine');
  assert.equal(parseWaterQualityTestItem('鉛').testItemCategory, 'metal');
  assert.equal(parseWaterQualityTestItem('巴拉刈').testItemCategory, 'pesticide');
});

test('clear-water detection status preserves source-reported zero', () => {
  assert.deepEqual(deriveDetectionStatus({ measuredValue: 0, methodDetectionLimit: 0.01 }), { isDetected: false, isZeroReported: true, isBelowDetectionLimit: true });
});
