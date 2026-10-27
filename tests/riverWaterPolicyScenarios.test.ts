import test from 'node:test';
import assert from 'node:assert/strict';
import type { PolicyRow, PolicySnapshot } from '../src/types/riverWaterPolicy';
import { POLICY_METHOD } from '../src/types/riverWaterPolicy';
import { riverIndicatorKeys } from '../src/types/riverWaterQuality';
import { buildPolicyCandidates, comparePolicyScenarios, makePolicyBriefing, policyBriefingCsv, policyBriefingJson, policyCsvCell, resolvePolicyConfig, runPolicyScenario } from '../src/utils/riverWaterPolicyScenarios';

function row(id: string, river = 'river-1', station = 'station-1', month = 1): PolicyRow {
  return {
    id, sourceId: '2025', sourceSha256: 'a'.repeat(64), rowNumber: month + 1, year: 2025, yearRoc: 114, month,
    period: `2025-${String(month).padStart(2, '0')}`, riverName: river, stationName: station, stationId: `${river}:${station}`,
    identityStatus: 'label_verified', status: 'valid_observed', issues: [], completeFourIndicators: true, rpiEligible: false,
    values: Object.fromEntries(riverIndicatorKeys.map(indicator => [indicator, { raw: '1', value: 1, qualifier: 'measured', unit: 'mg/L' }])) as PolicyRow['values'],
  };
}
function snapshot(rows: PolicyRow[] = [row('r1')]): PolicySnapshot {
  return {
    schemaVersion: '1.0.0', methodId: POLICY_METHOD, analysisDate: '2026-10-27', rows,
    sources: [{ sourceId: '2025', datasetId: 'dataset', resourceId: 'resource', catalogueUrl: 'https://data.taipei/', downloadUrl: 'https://data.taipei/', publisher: 'publisher', yearRoc: 114, year: 2025, updatedAt: '2026-01-01', retrievedAt: '2026-10-27', sha256: 'a'.repeat(64), byteLength: 10, encoding: 'big5', columns: [], admissionStatus: 'accepted' }],
    stations: [], coverage: [], qualifierCounts: {} as PolicySnapshot['qualifierCounts'], comparisons: [],
    rpi: { available: false, label: 'Research-reproduced RPI', completeInputCount: 1, eligibleCount: 0, excludedCount: 1, blockers: ['unverified rounding'], officialMethodUrl: 'https://wq.moenv.gov.tw/' },
    totals: {} as PolicySnapshot['totals'], limitations: ['Monthly measurements do not establish causation.'],
  };
}
const integrity = { snapshotId: `sha256-${'a'.repeat(64)}`, sha256: 'a'.repeat(64) };

test('policy tiers reflect source questions, distinguish future placeholders, and retain raw lineage', () => {
  const partial = row('partial', 'river-1', 'station-1', 2);
  partial.status = 'partially_observed'; partial.completeFourIndicators = false;
  partial.values.cadmiumUgL = { raw: 'ND<0.02', qualifier: 'not_detected_below', detectionLimit: 0.02, unit: 'μg/L' };
  const future = row('future', 'river-1', 'station-1', 11); future.status = 'future_placeholder'; future.completeFourIndicators = false;
  const ambiguous = row('ambiguous', 'river-1', 'station-1', 3); ambiguous.identityStatus = 'ambiguous';
  const records = snapshot([row('routine'), partial, future, ambiguous]);
  const candidates = buildPolicyCandidates(records);
  assert.equal(candidates.find(c => c.rowIds.includes('routine'))!.tier, 'C');
  assert.equal(candidates.find(c => c.rowIds.includes('ambiguous'))!.tier, 'A');
  const p = candidates.find(c => c.rowIds.includes('partial'))!;
  assert.equal(p.tier, 'B'); assert.deepEqual(p.qualifierCounts, { measured: 26, not_detected_below: 1 });
  assert.ok(p.issueCodes.includes('censored_value')); assert.ok(p.issueCodes.includes('missing_rpi_inputs'));
  const f = candidates.find(c => c.rowIds.includes('future'))!;
  assert.equal(f.eligible, false); assert.deepEqual(f.exclusionReasons, ['future_placeholder_not_due']);
  const all = runPolicyScenario(candidates, 'gaps', 'all');
  assert.equal(all.eligiblePopulation, 3); assert.equal(all.excludedPopulation, 1);
  assert.equal(all.selected[0].tier, 'A'); assert.equal(all.unusedCapacity, 0);
});

test('duplicate station-period rows become one primary question while same labels across rivers remain distinct', () => {
  const candidates = buildPolicyCandidates(snapshot([row('a'), row('b'), row('other', 'river-2')]));
  assert.equal(candidates.length, 2);
  const duplicated = candidates.find(candidate => candidate.rowIds.length === 2)!;
  assert.equal(duplicated.tier, 'A'); assert.ok(duplicated.issueCodes.includes('duplicate_period'));
  assert.equal(duplicated.publishedRowCount, 2); assert.deepEqual(duplicated.rowIds, ['a', 'b']);
});

test('current-period published blank rows remain pending rather than historical missing or overdue', () => {
  const pending = row('pending', 'river-1', 'station-1', 10);
  pending.status = 'present_no_indicators'; pending.completeFourIndicators = false;
  const candidate = buildPolicyCandidates(snapshot([pending]))[0];
  assert.ok(candidate.issueCodes.includes('current_period_pending'));
  assert.ok(!candidate.issueCodes.includes('historical_missing'));
  assert.equal(candidate.tier, 'B'); assert.equal(candidate.observedRowCount, 0);
});

test('evidence-first and balanced strategies use identical eligible population with tier precedence', () => {
  const rows = [row('a', 'river-1', 's1', 1), row('b', 'river-1', 's1', 2), row('c', 'river-1', 's2', 1), row('d', 'river-1', 's2', 2), row('e', 'river-1', 's3', 1), row('f', 'river-2', 's4', 1), row('g', 'river-3', 's5', 1)];
  const candidates = buildPolicyCandidates(snapshot(rows));
  const gaps = runPolicyScenario(candidates, 'gaps', 5), balanced = runPolicyScenario(candidates, 'balanced', 5);
  assert.equal(gaps.eligiblePopulation, balanced.eligiblePopulation);
  assert.equal(gaps.rivers.length, 1); assert.equal(balanced.rivers.length, 3);
  const comparison = comparePolicyScenarios(gaps, balanced);
  assert.equal(comparison.sameEligiblePopulation, true);
  assert.equal(comparison.eligiblePopulationChange, 0); assert.equal(comparison.addedIds.length, 2); assert.equal(comparison.removedIds.length, 2);
  rows[0].issues = ['invalid_period'];
  assert.equal(runPolicyScenario(buildPolicyCandidates(snapshot(rows)), 'balanced', 5).selected[0].tier, 'A');
  rows[0].issues = ['historical_missing']; rows[1].issues = ['partial_measurement'];
  const issueSelected = runPolicyScenario(buildPolicyCandidates(snapshot(rows)), 'balanced', 5).selected;
  assert.equal(issueSelected[0].issueCodes[0], 'historical_missing');
  assert.equal(issueSelected[1].issueCodes[0], 'partial_measurement');
});

test('equal candidate counts do not conceal changed eligible population identities', () => {
  const before = runPolicyScenario(buildPolicyCandidates(snapshot([row('a', 'river-1')])));
  const after = runPolicyScenario(buildPolicyCandidates(snapshot([row('b', 'river-2')])));
  const change = comparePolicyScenarios(before, after);
  assert.equal(change.eligiblePopulationChange, 0); assert.equal(change.sameEligiblePopulation, false);
  assert.equal(change.addedIds.length, 1); assert.equal(change.removedIds.length, 1);
  assert.match(change.explanation, /populations differ/);
});

test('all capacities and shuffled input reproduce actual selected IDs and do not mutate candidates', () => {
  const candidates = buildPolicyCandidates(snapshot(Array.from({ length: 12 }, (_, i) => row(`row-${i}`, `river-${i % 3}`, `station-${i % 4}`, i + 1))));
  const before = JSON.stringify(candidates);
  for (const capacity of [5, 10, 'all'] as const) for (const strategy of ['gaps', 'balanced'] as const) {
    const result = runPolicyScenario(candidates, strategy, capacity);
    assert.equal(result.selectedCount, capacity === 'all' ? 12 : capacity);
    assert.deepEqual(runPolicyScenario([...candidates].reverse(), strategy, capacity), result);
  }
  assert.equal(JSON.stringify(candidates), before);
  assert.throws(() => runPolicyScenario(candidates, 'gaps', 0 as 5));
  assert.throws(() => runPolicyScenario([candidates[0], candidates[0]]));
});

test('filters change documented scope, qualify individual indicator cells, and do not impute censored results', () => {
  const first = row('a'); first.values.cadmiumUgL = { raw: '<10', qualifier: 'not_detected_below', detectionLimit: 10 };
  const second = row('b', 'river-2'); second.year = 2024;
  const s = snapshot([first, second]);
  const candidates = buildPolicyCandidates(s, { years: [2025], indicator: 'cadmiumUgL', rivers: ['river-1'], sourceIds: ['2025'] });
  assert.equal(candidates.length, 1); assert.deepEqual(candidates[0].qualifierCounts, { not_detected_below: 1 });
  assert.equal(first.values.cadmiumUgL.value, undefined);
  const changed = comparePolicyScenarios(runPolicyScenario(buildPolicyCandidates(s)), runPolicyScenario(candidates));
  assert.equal(changed.eligiblePopulationChange, -1); assert.match(changed.explanation, /populations differ/);
  assert.throws(() => resolvePolicyConfig({ indicator: 'not-an-indicator' as 'all' }));
  assert.throws(() => resolvePolicyConfig({ years: [NaN] }));
});

test('Mode B strict gate remains closed when physical station continuity is unverified; limited pairs labeled', () => {
  const s = snapshot([row('from'), row('to')]); s.rows[0].year = 2024;
  s.comparisons.push({ id: 'paired', stationId: s.rows[0].stationId, stationName: 'station-1', riverName: 'river-1', indicator: 'dissolvedOxygenMgL', fromYear: 2024, toYear: 2025, matchedCount: 1, excludedCount: 11,
    pairs: [{ month: 1, fromId: 'from', toId: 'to', fromValue: 1, toValue: 2, change: 1 }], strictEligible: false, limitedEligible: true, exclusionReasons: ['physical_continuity_unverified'] });
  const strict = runPolicyScenario(buildPolicyCandidates(s, { mode: 'B' }));
  assert.equal(strict.selectedCount, 0); assert.equal(strict.excludedPopulation, 1); assert.equal(strict.unusedCapacity, 5);
  const limited = runPolicyScenario(buildPolicyCandidates(s, { mode: 'B', evidence: 'limited' }));
  assert.equal(limited.selectedCount, 1); assert.equal(limited.selected[0].comparisonValidity, 'limited'); assert.equal(limited.selected[0].rpiEligible, false);
  assert.deepEqual(limited.selected[0].qualifierCounts, { measured: 2 });
  const censored = row('excluded-censored', 'river-1', 'station-1', 2);
  censored.values.dissolvedOxygenMgL = { raw: '<10', qualifier: 'not_detected_below', detectionLimit: 10, unit: 'mg/L' };
  s.rows.push(censored);
  const withExcluded = runPolicyScenario(buildPolicyCandidates(s, { mode: 'B', evidence: 'limited' }));
  assert.deepEqual(withExcluded.selected[0].qualifierCounts, { measured: 2 });
  assert.deepEqual(withExcluded.selected[0].excludedQualifierCounts, { not_detected_below: 1 });
  const exported = makePolicyBriefing(s, { mode: 'B', evidence: 'limited' }, withExcluded, integrity);
  assert.deepEqual(JSON.parse(policyBriefingJson(exported)).selected[0].qualifierCounts, { measured: 2 });
  assert.ok(policyBriefingCsv(exported).includes('excludedQualifierCounts'));
  assert.equal(runPolicyScenario(buildPolicyCandidates(s, { mode: 'B', evidence: 'limited', years: [2025] })).selectedCount, 0);
  s.rows = s.rows.slice(0, 1);
  assert.equal(runPolicyScenario(buildPolicyCandidates(s, { mode: 'B', evidence: 'limited' })).selectedCount, 0);
});

test('Mode C remains unavailable for every capacity and cannot fabricate eligible conclusions', () => {
  const s = snapshot();
  assert.deepEqual(buildPolicyCandidates(s, { mode: 'C' }), []);
  for (const capacity of [5, 10, 'all'] as const) assert.equal(runPolicyScenario(buildPolicyCandidates(s, { mode: 'C' }), 'balanced', capacity).eligiblePopulation, 0);
});

test('safe briefing exports include source lineage, eligibility, configuration and valid empty output', () => {
  const s = snapshot(); s.rows[0].stationName = '=HYPERLINK("https://invalid")';
  const result = runPolicyScenario(buildPolicyCandidates(s));
  const briefing = makePolicyBriefing(s, {}, result, integrity);
  const json = policyBriefingJson(briefing), csv = policyBriefingCsv(briefing);
  assert.equal(JSON.parse(json).selectedIds[0], result.selectedIds[0]);
  assert.ok(csv.includes('"\'=HYPERLINK(""https://invalid"")"'));
  assert.ok(csv.includes('sourceEditions')); assert.ok(csv.includes('qualifierCounts')); assert.ok(csv.includes('rpiEligible'));
  assert.throws(() => makePolicyBriefing(s, {}, result, { snapshotId: 'bad', sha256: 'not verified' }));
  assert.throws(() => makePolicyBriefing(s, { years: [2024] }, result, integrity), /does not match/);
  const empty = makePolicyBriefing(s, { mode: 'C' }, runPolicyScenario([]), integrity);
  assert.match(policyBriefingCsv(empty), /empty_result/);
  assert.deepEqual(JSON.parse(policyBriefingJson(empty)).selectedIds, []);
  assert.match(empty.candidateGrain, /unavailable/);
  assert.throws(() => policyBriefingJson({ ...empty, limitations: ['x'.repeat(13 * 1024 * 1024)] }), /size limit/);
  for (const value of ['=SUM(1,2)', '+1', '-1', '@data', '\t=1', '  =1', '\n=1']) assert.ok(policyCsvCell(value).startsWith('"\''));
  assert.equal(policyCsvCell('ordinary,"quoted"'), '"ordinary,""quoted"""');
});
