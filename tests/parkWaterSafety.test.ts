import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyParkWaterSafetyFacility, parseDistrictFromResourceNameOrLocation, parseParkName, parseParkWaterSafetyCoordinates } from '../src/utils/parkWaterSafety';

test('park water-safety classifier detects common facility types', () => {
  assert.equal(classifyParkWaterSafetyFacility('水域安全告示牌'), 'water_safety_sign');
  assert.equal(classifyParkWaterSafetyFacility('救生圈'), 'lifebuoy');
  assert.equal(classifyParkWaterSafetyFacility('告示牌及救生設備'), 'combined_sign_and_equipment');
});

test('park water-safety parser derives district and conservative park names', () => {
  assert.equal(parseDistrictFromResourceNameOrLocation('萬華區公園水域安全告示及救生設備位置'), '萬華區');
  assert.equal(parseParkName('大湖公園親水平台旁'), '大湖公園');
});

test('park water-safety coordinates convert TWD97 and accept WGS84-like values', () => {
  const twd97 = parseParkWaterSafetyCoordinates('305000', '2770000');
  assert.equal(twd97.sourceCoordinateSystem, 'twd97');
  assert.equal(twd97.coordinateStatus, 'valid');
  const wgs84 = parseParkWaterSafetyCoordinates('121.56', '25.04');
  assert.equal(wgs84.sourceCoordinateSystem, 'wgs84');
  assert.equal(wgs84.coordinateStatus, 'valid');
});
