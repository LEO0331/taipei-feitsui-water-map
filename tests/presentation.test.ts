import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatNumber } from '../src/utils/presentation';

test('operation cards and exports preserve significant integer zeros', () => {
  for (const value of [0, 10, 100, 120, -120, 1234560]) {
    assert.equal(formatNumber(value, 'm3', 0), `${value} m3`);
  }
  const summaries = JSON.parse(readFileSync('public/data/operation-monthly-summary.json', 'utf8'));
  const february = summaries.find((row: { period: string }) => row.period === '2026-02');
  assert.equal(formatNumber(february.totalReservoirInflowM3, 'm3', 0), '31625100 m3');
  assert.equal(formatNumber(february.totalReservoirOutflowM3, 'm3', 0), '48527100 m3');
});

test('numeric formatting trims only fractional padding and retains missing values', () => {
  assert.equal(formatNumber(100, 'm', 1), '100 m');
  assert.equal(formatNumber(12.34, '', 3), '12.34');
  assert.equal(formatNumber(12.34, '', 1), '12.3');
  assert.equal(formatNumber(0, '', 2), '0');
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(formatNumber(value), '-');
});
