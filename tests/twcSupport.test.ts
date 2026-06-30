import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSupportMetrics, parseSupportMonthDate, parseWaterVolume } from '../src/utils/twcSupport';
import type { TaipeiWaterSupportTwcMonthlyRecord } from '../src/types/twcSupport';

test('support date parser accepts Gregorian and ROC month formats', () => {
  assert.equal(parseSupportMonthDate('2025/01/31').monthKey, '2025-01');
  assert.equal(parseSupportMonthDate('114/02').date, '2025-02-01');
  assert.equal(parseSupportMonthDate('1140301').quarter, '2025-Q1');
});

test('support volume parser preserves missing values', () => {
  assert.equal(parseWaterVolume('1,234.5'), 1234.5);
  assert.equal(parseWaterVolume('-'), undefined);
  assert.equal(parseWaterVolume('NaN'), undefined);
});

test('support metrics derive shares and rolling totals only with complete 12 months', () => {
  const records = Array.from({ length: 13 }, (_, index) => ({
    id: String(index),
    module: 'taipei_water_support_twc_monthly_statistics',
    date: `2025-${String(index + 1).padStart(2, '0')}-01`,
    year: index < 12 ? 2025 : 2026,
    month: index < 12 ? index + 1 : 1,
    monthKey: index < 12 ? `2025-${String(index + 1).padStart(2, '0')}` : '2026-01',
    totalSupportVolume: 100,
    firstDistrictOfficeSupportVolume: 25,
    twelfthDistrictOfficeSupportVolume: 75,
    supportVolumeUnit: 'raw',
    isLatestMonth: false,
    source: '臺北自來水事業處支援台水月統計表',
    sourceAgency: '臺北自來水事業處',
  })) satisfies TaipeiWaterSupportTwcMonthlyRecord[];
  const derived = deriveSupportMetrics(records);
  assert.equal(derived[0].firstDistrictOfficeSharePercent, 25);
  assert.equal(derived[0].rolling12MonthTotalSupportVolume, undefined);
  assert.equal(derived[11].rolling12MonthTotalSupportVolume, 1200);
  assert.equal(derived[12].yearOverYearTotalChange, 0);
});
