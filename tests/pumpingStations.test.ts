import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertTwd97ToWgs84,
  parseEstablishedDate,
  parseManagementDistrictNumber,
} from '../src/utils/pumpingStations';

test('pumping station parser treats YYYYMMDD as a Gregorian establishment date', () => {
  assert.deepEqual(parseEstablishedDate('19821101'), {
    establishedDateRaw: '19821101',
    establishedDate: '1982-11-01',
    establishedYear: 1982,
    establishedDecade: '1980s',
  });
});

test('pumping station parser derives management district numbers only from clear labels', () => {
  assert.equal(parseManagementDistrictNumber('抽管科第四分區管理所'), 4);
  assert.equal(parseManagementDistrictNumber('未知單位'), undefined);
});

test('TWD97 pumping station coordinates convert into Taipei bounds', () => {
  const point = convertTwd97ToWgs84(303357.64, 2773912.6);
  assert.ok(point.longitude >= 121.43 && point.longitude <= 121.70);
  assert.ok(point.latitude >= 24.90 && point.latitude <= 25.25);
});
