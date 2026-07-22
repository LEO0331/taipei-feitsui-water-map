import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNumber, parseSurveyDateRange } from '../src/utils/reservoirSedimentationSurvey';

test('sedimentation survey parser handles ROC/Gregorian ranges and source formatting', () => {
  assert.deepEqual(parseSurveyDateRange('73.07-78.03'), { startYear: 1984, startMonth: 7, endYear: 1989, endMonth: 3, endPeriod: '1989-03', endDate: null });
  assert.deepEqual(parseSurveyDateRange('2024/01 至 2024/12'), { startYear: 2024, startMonth: 1, endYear: 2024, endMonth: 12, endPeriod: '2024-12', endDate: null });
  assert.equal(parseNumber('377,333 千立方公尺'), 377333);
  assert.equal(parseNumber('7.06% ', true), 7.06);
  assert.equal(parseNumber('-'), null);
  assert.equal(parseNumber('-15'), null);
});
