import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inferRocYearFromFileName,
  parseRiverWaterQualityValue,
} from '../src/utils/riverWaterQuality';

test('river parser preserves detection limits and missing states', () => {
  assert.deepEqual(parseRiverWaterQualityValue('ND<0.02', 'mg/L'), {
    raw: 'ND<0.02',
    qualifier: 'not_detected_below',
    detectionLimit: 0.02,
    unit: 'mg/L',
  });
  assert.equal(parseRiverWaterQualityValue('---').qualifier, 'not_measured');
  assert.equal(parseRiverWaterQualityValue('').qualifier, 'missing');
  assert.equal(parseRiverWaterQualityValue('<10').detectionLimit, 10);
});

test('river parser accepts scientific notation and infers ROC year', () => {
  assert.equal(parseRiverWaterQualityValue('6.50E+03').value, 6500);
  assert.equal(inferRocYearFromFileName('115河川水質檢測結果(Big5編碼).csv'), 115);
});
