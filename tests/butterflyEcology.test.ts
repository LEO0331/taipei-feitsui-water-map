import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDate } from '../src/utils/butterflyEcology';

test('butterfly ecology date parser rejects zero and invalid survey dates', () => {
  assert.equal(parseDate('2014', '5', '24'), '2014-05-24');
  assert.equal(parseDate('0', '0', '0'), null);
  assert.equal(parseDate('2014', '2', '30'), null);
});
