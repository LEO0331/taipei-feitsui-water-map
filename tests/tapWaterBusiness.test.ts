import assert from 'node:assert/strict';
import test from 'node:test';
import { addMonthOverMonthAndYearOverYearChanges, addRolling12MonthSums, deriveTapWaterBusinessMetrics, parseMetricNumber, parseRocYearMonth } from '../src/utils/tapWaterBusiness';
import type { TapWaterBusinessKeyMetricRecord } from '../src/types/tapWaterBusiness';

const base = (monthKey: string, value: number): TapWaterBusinessKeyMetricRecord => {
  const [year, month] = monthKey.split('-').map(Number);
  return {
    id: monthKey,
    module: 'tap_water_business_key_metrics',
    periodRaw: `${year - 1911}${String(month).padStart(2, '0')}`,
    rocYear: year - 1911,
    year,
    month,
    monthKey,
    periodDate: `${monthKey}-01`,
    quarter: `${year}-Q${Math.ceil(month / 3)}`,
    yearMonthLabel: monthKey,
    isLatestMonth: false,
    distributedWaterVolumeM3: value,
    billedWaterVolumeM3: value / 2,
    taiwanWaterSupportVolumeM3: value / 4,
    waterUseExcludingTaiwanWaterSupportM3: value / 4,
    monthlyRevenueThousandNtd: value,
    monthlyExpenseThousandNtd: value / 2,
    monthlySurplusThousandNtd: value / 2,
    sourceRecordHash: monthKey,
    source: '臺北自來水事業處業務關鍵數據',
    sourceAgency: '臺北自來水事業處',
  };
};

test('business KPI ROC month parser accepts compact and slash formats', () => {
  assert.equal(parseRocYearMonth('11105').monthKey, '2022-05');
  assert.equal(parseRocYearMonth('115/4').monthKey, '2026-04');
  assert.equal(parseRocYearMonth('民國115年4月').quarter, '2026-Q2');
  assert.match(parseRocYearMonth('11599').warning ?? '', /Invalid/);
});

test('business KPI numeric parser preserves commas, negatives, and missing values', () => {
  assert.equal(parseMetricNumber('"1,727,260"').value, 1727260);
  assert.equal(parseMetricNumber('-123.5').value, -123.5);
  assert.deepEqual(parseMetricNumber('--'), { raw: '--' });
});

test('business KPI derived metrics compute only from source values', () => {
  const record = deriveTapWaterBusinessMetrics({
    ...base('2026-04', 100),
    supplyAreaTotalPopulation: 1000,
    supplyAreaServedPopulation: 990,
    userCount: 500,
    salesRevenueThousandNtd: 10,
    serviceRevenueThousandNtd: 5,
    otherOperatingRevenueThousandNtd: 1,
    salesCostThousandNtd: 7,
    serviceCostThousandNtd: 2,
    otherOperatingCostThousandNtd: 1,
    assetsThousandNtd: 1000,
    liabilitiesThousandNtd: 250,
    equityThousandNtd: 750,
  });
  assert.equal(record.supportShareOfDistributedWaterPercent, 25);
  assert.equal(record.billedShareOfDistributedWaterPercent, 50);
  assert.equal(record.nonRevenueOrUnbilledWaterApproxM3, 50);
  assert.equal(record.populationServedSharePercent, 99);
  assert.equal(record.usersPerThousandPopulation, 500);
  assert.equal(record.operatingRevenueThousandNtd, 16);
  assert.equal(record.operatingExpenseThousandNtd, 10);
  assert.equal(record.debtRatioPercent, 25);
});

test('business KPI change and rolling metrics require comparison periods', () => {
  const records = Array.from({ length: 13 }, (_, index) => base(`2025-${String(index + 1).padStart(2, '0')}`, 100 + index));
  const withChanges = addMonthOverMonthAndYearOverYearChanges(records);
  assert.equal(withChanges[1].monthOverMonthChanges?.distributedWaterVolumeM3.change, 1);
  const withRolling = addRolling12MonthSums(withChanges);
  assert.equal(withRolling[10].rolling12MonthSums, undefined);
  assert.equal(withRolling[11].rolling12MonthSums?.distributedWaterVolumeM3, 1266);
});
