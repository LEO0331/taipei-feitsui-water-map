import test from 'node:test';
import assert from 'node:assert/strict';
import type { PreparednessSnapshot, PreparednessSource } from '../src/types/preparedness';
import { DISTRICTS, briefingCsv, buildCandidates, compareScenarios, csvCell, makeBriefing, runScenario, validateDecisionSnapshot } from '../src/utils/preparednessDecision';

function fixture(): PreparednessSnapshot {
  const sources: PreparednessSource[] = ['pumping', 'machinery', 'basin', 'flood-prone'].map(sourceId => ({
    sourceId, datasetId: sourceId, resourceId: `${sourceId}-edition`, sourceUrl: 'https://data.taipei/',
    publicationDate: '2026-06-01', retrievedAt: '2026-10-19', sourceSha256: 'a'.repeat(64), version: '2026', status: 'verified', recordCount: 12, rejectedCount: 0, limitations: [],
  }));
  return { schemaVersion: '1.0.0', methodologyVersion: 'heavy-rain-preparedness-review-v1', snapshotVersion: 'fixture-1', processedAt: '2026-10-19T00:00:00Z',
    sources, inventory: DISTRICTS.flatMap(district => (['pumping', 'machinery', 'basin'] as const).map(assetType => ({
      id: `${district}-${assetType}`, sourceId: assetType, assetType, district, name: 'Public facility', coordinateStatus: 'verified' as const, longitude: 121.5, latitude: 25.05, qualityFlags: [],
    }))), reviewAreas: [], historicalByDistrict: [], limitations: ['Fixture: no operational claims'], geographyReason: 'No authoritative service-area relationships', floodContextAvailable: true };
}

test('tiers use independent gaps and official context, never inventory quantity', () => {
  const s = fixture();
  const record = s.inventory[0];
  record.coordinateStatus = 'missing';
  record.qualityFlags = ['invalid_coordinate', 'duplicate_identity', 'operational_status_unknown'];
  s.reviewAreas.push({ id: 'official', district: record.district, sourceId: 'flood-prone', geometry: { type: 'Polygon', coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25]]] } });
  const candidates = buildCandidates(s);
  const a = candidates.find(c => c.id === `${record.district}:pumping`)!;
  assert.equal(a.tier, 'A');
  assert.deepEqual(a.gaps.map(g => g.code), ['identity_geography', 'operational_evidence']);
  assert.equal(candidates.find(c => c.id === `${record.district}:machinery`)!.tier, 'B');
  assert.equal(candidates.find(c => c.district !== record.district)!.tier, 'C');
  s.reviewAreas = [];
  assert.equal(buildCandidates(s).find(c => c.id === a.id)!.tier, 'B');
  record.qualityFlags = [];
  record.coordinateStatus = 'verified';
  s.inventory.push({ ...record, id: 'another-source-record' });
  assert.equal(buildCandidates(s).find(c => c.id === a.id)!.tier, 'C');
});

test('missing source collapses multiple missing attributes into one failure and insufficient evidence', () => {
  const s = fixture();
  s.sources[0].status = 'unavailable';
  s.sources[0].publicationDate = null;
  s.inventory[0].qualityFlags = ['invalid_coordinate', 'operational_status_unknown', 'catchment_relationship_unverified'];
  const c = buildCandidates(s).find(c => c.assetType === 'pumping')!;
  assert.equal(c.tier, 'insufficient');
  assert.equal(c.eligible, false);
  assert.deepEqual(c.gaps.map(g => g.code), ['source_failure']);
  assert.equal(c.recordCount, 0);
});

test('zero source records represent a coverage question rather than unprotected geography', () => {
  const s = fixture();
  s.inventory = [];
  const candidates = buildCandidates(s);
  assert.equal(candidates.length, 36);
  assert.ok(candidates.every(c => c.tier === 'B' && c.gaps.length === 1));
  assert.match(candidates[0].gaps[0].question, /does not establish absence of protection/);
});

test('ranking stable IDs and capacities 5, 10, custom, unlimited and eligible limits', () => {
  const candidates = buildCandidates(fixture());
  const a = runScenario(candidates, 'gaps', 5);
  const b = runScenario([...candidates].reverse(), 'gaps', 5);
  assert.deepEqual(a.selected, b.selected);
  assert.equal(a.selected.length, 5);
  assert.equal(runScenario(candidates, 'gaps', 10).selected.length, 10);
  assert.equal(runScenario(candidates, 'gaps', 2).selected.length, 2);
  assert.equal(runScenario(candidates, 'gaps', 'unlimited').selected.length, 36);
  assert.equal(runScenario(candidates.slice(0, 2), 'gaps', 10).selected.length, 2);
  for (const capacity of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => runScenario(candidates, 'gaps', capacity));
});

test('balanced scenario round-robins districts while keeping exact population fixed', () => {
  const candidates = buildCandidates(fixture());
  const a = runScenario(candidates, 'gaps', 5);
  const b = runScenario(candidates, 'balanced', 5);
  assert.equal(b.districtCount, 5);
  assert.ok(a.districtCount < b.districtCount);
  assert.equal(compareScenarios(a, b).sameEvidenceScope, true);
  assert.equal(compareScenarios(a, runScenario(candidates, 'gaps', 10)).stableIds.length, 5);
  assert.equal(new Set(b.ranked.map(c => c.id)).size, 36);
});

test('stale and permissive filters explicitly change evidence scope and never mutate inputs', () => {
  const s = fixture();
  s.sources[0].publicationDate = '2010-01-01';
  s.sources[1].status = 'limited';
  const original = JSON.stringify(s);
  const strict = buildCandidates(s);
  const permissive = buildCandidates(s, { evidenceRequirement: 'permissive' });
  assert.ok(strict.filter(c => c.assetType === 'machinery').every(c => !c.eligible));
  assert.ok(permissive.filter(c => c.assetType === 'machinery').every(c => c.eligible));
  const fresh = buildCandidates(s, { includeStaleSources: false });
  assert.ok(fresh.filter(c => c.assetType === 'pumping').every(c => !c.eligible));
  assert.equal(compareScenarios(runScenario(strict, 'gaps', 5), runScenario(fresh, 'gaps', 5)).sameEvidenceScope, false);
  assert.equal(JSON.stringify(s), original);
  assert.throws(() => runScenario([strict[0], fresh[1]], 'gaps', 5), /one evidence scope/);
});

test('mode A survives unavailable flood input; mode B and flood scenario explain unavailable evidence', () => {
  const s = fixture();
  s.floodContextAvailable = false;
  s.sources[3].status = 'unavailable';
  assert.equal(runScenario(buildCandidates(s), 'gaps', 5).selected.length, 5);
  assert.equal(runScenario(buildCandidates(s, { mode: 'flood' }), 'gaps', 5).selected.length, 0);
  assert.match(runScenario(buildCandidates(s), 'flood', 5).unavailableReason!, /No eligible official/);
});

test('historical counts never raise priority on their own and out-of-scope records contribute nothing', () => {
  const s = fixture();
  s.sources.push({ ...s.sources[3], sourceId: 'historical-inundation' });
  s.historicalByDistrict = [{ district: DISTRICTS[0], sourceId: 'historical-inundation', observationCount: 99999, distinctDateCount: 1, eventDates: ['2001-01-01'] }];
  const candidate = buildCandidates(s)[0];
  assert.equal(candidate.tier, 'B');
  assert.equal(candidate.gaps.length, 0);
  s.inventory[0].qualityFlags = ['operational_status_unknown', 'catchment_relationship_unverified'];
  assert.equal(buildCandidates(s)[0].tier, 'B', 'History plus multiple questions cannot qualify A without official designation');
  s.sources[s.sources.length - 1].status = 'limited';
  assert.equal(buildCandidates(s)[0].officialContext, false);
  const permissive = buildCandidates(s, { evidenceRequirement: 'permissive' })[0];
  assert.equal(permissive.officialContext, true);
  assert.equal(permissive.officialDesignation, false);
  assert.equal(permissive.tier, 'B');
  assert.ok(!permissive.verifiedSourceTypes.includes('historical-inundation'));
  const filtered = buildCandidates(s, { districts: [DISTRICTS[1]], assetTypes: ['basin'] });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].historicalObservations, 0);
  assert.equal(filtered[0].tier, 'C');
});

test('explicit source age breaks otherwise equal ties and unknown date remains unknown', () => {
  const s = fixture();
  s.sources[0].publicationDate = '2025-01-01';
  s.sources[1].publicationDate = '2026-01-01';
  const result = runScenario(buildCandidates(s), 'gaps', 5);
  assert.equal(result.selected[0].assetType, 'pumping');
  s.sources[0].publicationDate = null;
  const candidate = buildCandidates(s).find(c => c.assetType === 'pumping')!;
  assert.equal(candidate.ageDays, null);
  assert.ok(candidate.gaps.some(g => g.code === 'temporal_version'));
});

test('ranking compares tier, independent questions, verified source types and version uncertainty before age and stable ID', () => {
  const base = buildCandidates(fixture())[0];
  const candidates = [
    { ...base, id: 'age', ageDays: 999 },
    { ...base, id: 'version', versionUncertain: true },
    { ...base, id: 'sources', verifiedSourceTypes: ['pumping', 'flood-prone'] },
    { ...base, id: 'question', gaps: [{ code: 'operational_evidence', dimension: 'operational_evidence', sourceId: 'pumping', sourceIds: ['pumping'], question: 'Verify records' }] },
    { ...base, id: 'tier', tier: 'B' as const },
  ];
  assert.deepEqual(runScenario(candidates.reverse(), 'gaps', 'unlimited').selected.map(c => c.id), ['tier', 'question', 'sources', 'version', 'age']);
});

test('official flood scenario uses only validated eligible reference inputs, never nearby asset presence', () => {
  const s = fixture();
  s.reviewAreas.push({ id: 'official', district: DISTRICTS[0], sourceId: 'flood-prone', geometry: { type: 'Polygon', coordinates: [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25]]] } });
  const result = runScenario(buildCandidates(s), 'flood', 10);
  assert.equal(result.selected.length, 3);
  assert.ok(result.selected.every(c => c.district === DISTRICTS[0] && c.officialContext));
  s.sources[3].status = 'limited';
  assert.equal(runScenario(buildCandidates(s, { evidenceRequirement: 'permissive' }), 'flood', 10).selected.length, 0);
});

test('briefing and CSV preserve provenance/configuration/limitations and whitelist fields against private-data leakage', () => {
  const s = fixture();
  s.sources[0].limitations = ['Period mismatch: historical source does not establish current condition'];
  s.sources[0].coordinateSystem = 'EPSG:3826';
  s.sources[0].temporalCoverage = { start: '2001-01-01', end: '2026-01-01' };
  Object.assign(s.inventory[0], { officerName: 'PRIVATE_PERSON', mobile: 'PRIVATE_PHONE' });
  Object.assign(s.sources[0], { directContact: 'PRIVATE_CONTACT' });
  const report = makeBriefing(s, {}, 'balanced', 5);
  const json = JSON.stringify(report);
  const csv = briefingCsv(report);
  assert.doesNotMatch(json + csv, /PRIVATE_/);
  assert.ok(json.includes('Period mismatch') && csv.includes('Period mismatch'));
  assert.ok(json.includes('EPSG:3826') && csv.includes('2001-01-01'));
  for (const text of ['heavy-rain-preparedness-review-v1', 'fixture-1', 'sourceSha256', 'configurationVersion', 'limitations', 'unknownOperationalConditions', 'sensitivity', 'geographyReason']) assert.ok(csv.includes(text));
  assert.equal(report.result.selected.length, 5);
  assert.match(json, /Facility counts are not pumping capacity/);
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
  assert.equal(csvCell('  @SUM(A1)'), '"\'  @SUM(A1)"');
  assert.equal(csvCell('\tvalue'), '"\'\tvalue"');
  assert.equal(csvCell('a"b'), '"a""b"');
});

test('runtime snapshot boundary rejects malformed schema, duplicate source identity and invented coordinates', () => {
  const s = fixture();
  assert.equal(validateDecisionSnapshot(s), true);
  assert.equal(validateDecisionSnapshot({}), false);
  s.sources.push(s.sources[0]);
  assert.equal(validateDecisionSnapshot(s), false);
  s.sources.pop();
  s.inventory[0].longitude = 0;
  assert.equal(validateDecisionSnapshot(s), false);
  assert.throws(() => buildCandidates(s), /Invalid preparedness snapshot/);
  for (const malformed of [null, [null], [{ geometry: null }], [{ geometry: { type: 'Polygon', coordinates: [] } }]]) {
    const raw = fixture() as unknown as Record<string, unknown>;
    raw.reviewAreas = malformed;
    assert.equal(validateDecisionSnapshot(raw), false);
  }
  const bowtie = fixture();
  bowtie.reviewAreas = [{ id: 'bowtie', district: DISTRICTS[0], sourceId: 'flood-prone', geometry: { type: 'Polygon', coordinates: [[[121.5, 25], [121.6, 25.1], [121.5, 25.1], [121.6, 25], [121.5, 25]]] } }];
  assert.equal(validateDecisionSnapshot(bowtie), false);
  bowtie.reviewAreas[0].geometry.coordinates = [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25]]];
  bowtie.reviewAreas[0].sourceId = 'pumping';
  assert.equal(validateDecisionSnapshot(bowtie), false);
  const overlap = fixture();
  const square = [[[121.5, 25], [121.6, 25], [121.6, 25.1], [121.5, 25.1], [121.5, 25]]];
  overlap.reviewAreas = [{ id: 'overlap', district: DISTRICTS[0], sourceId: 'flood-prone', geometry: { type: 'MultiPolygon', coordinates: [square, square] } }];
  assert.equal(validateDecisionSnapshot(overlap), false);
});
