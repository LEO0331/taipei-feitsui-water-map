import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySedimentationBasinCatchmentArea, convertTwd97Tm2ToWgs84, parseCatchmentArea, parseTaipeiDistrictName } from '../src/utils/sedimentationBasins';

test('sedimentation basin coordinates convert from TWD97 into Taipei bounds', () => {
  const point = convertTwd97Tm2ToWgs84(311352.94, 2774941.7);
  assert.equal(point.status, 'converted_from_twd97_tm2');
  assert.ok(point.longitude! >= 121.3 && point.longitude! <= 121.8);
  assert.ok(point.latitude! >= 24.85 && point.latitude! <= 25.3);
});

test('sedimentation basin parsers preserve zero area and normalize districts', () => {
  assert.equal(parseCatchmentArea('0').catchmentArea, 0);
  assert.equal(classifySedimentationBasinCatchmentArea(0), 'zero_or_not_reported');
  assert.deepEqual(parseTaipeiDistrictName('台北市'.replace('台北市', '內湖區')), { districtName: '內湖區', districtNameNormalized: '內湖區', isTaipeiDistrict: true, warning: undefined });
});
