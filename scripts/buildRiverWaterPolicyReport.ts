import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { riverIndicatorKeys } from '../src/types/riverWaterQuality';
import { verifyRiverWaterPolicy } from './verifyRiverWaterPolicy';
import { buildPolicyCandidates, comparePolicyScenarios, makePolicyBriefing, policyBriefingCsv, policyBriefingJson, runPolicyScenario } from '../src/utils/riverWaterPolicyScenarios';

/** Offline delivery evidence, derived from the same accepted snapshot and public scenario functions. */
async function main() {
  const { snapshot, pointer, bytes } = await verifyRiverWaterPolicy();
  const candidates = buildPolicyCandidates(snapshot);
  const scenarios = (['gaps', 'balanced'] as const).flatMap(strategy => ([5, 10, 'all'] as const).map(capacity => {
    const result = runPolicyScenario(candidates, strategy, capacity);
    return { strategy, capacity, population: result.population, eligiblePopulation: result.eligiblePopulation, excludedPopulation: result.excludedPopulation,
      selectedCount: result.selectedCount, selectedIds: result.selectedIds, rivers: result.rivers, stations: result.stations,
      tiers: result.tierCounts, unusedCapacity: result.unusedCapacity, selectionReasons: result.selectionReasons };
  }));
  const baseline = runPolicyScenario(candidates, 'gaps', 5);
  const latestYear = Math.max(...snapshot.sources.map(source => source.year));
  const latest = runPolicyScenario(buildPolicyCandidates(snapshot, { years: [latestYear] }), 'gaps', 5);
  const strictB = runPolicyScenario(buildPolicyCandidates(snapshot, { mode: 'B' }), 'gaps', 'all');
  const limitedB = runPolicyScenario(buildPolicyCandidates(snapshot, { mode: 'B', evidence: 'limited' }), 'balanced', 5);
  const briefing = makePolicyBriefing(snapshot, {}, baseline, pointer);
  const json = policyBriefingJson(briefing), csv = policyBriefingCsv(briefing);
  const directory = path.resolve('docs/evidence/river-water-policy');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'briefing.json'), json);
  await writeFile(path.join(directory, 'briefing.csv'), csv);
  const manifest = JSON.parse(await readFile('data/raw/river-water-policy/source-manifest.json', 'utf8'));
  const results = {
    policy: 13, methodId: snapshot.methodId, analysisDate: snapshot.analysisDate,
    baselineSha: '94b460758bda198bd1b83a0e7839814a944898ec', branch: 'codex/river-water-longitudinal-policy-13',
    snapshot: pointer, sourceManifest: manifest.sources, totals: snapshot.totals,
    rowsByStatus: Object.fromEntries([...new Set(snapshot.rows.map(row => row.status))].sort().map(status => [status, snapshot.rows.filter(row => row.status === status).length])),
    stationIdentity: { total: snapshot.stations.length, byStatus: Object.fromEntries(['label_verified', 'unmatched', 'ambiguous'].map(status => [status, snapshot.stations.filter(station => station.identityStatus === status).length])), verifiedPhysicalContinuity: snapshot.stations.filter(station => station.physicalContinuity === 'verified').length, mapPins: 0 },
    qualifierCounts: snapshot.qualifierCounts,
    detectionLimits: Object.fromEntries(riverIndicatorKeys.map(key => {
      const limits: Record<string, number> = {};
      for (const row of snapshot.rows) if (row.values[key].qualifier === 'not_detected_below') {
        const limit = String(row.values[key].detectionLimit); limits[limit] = (limits[limit] ?? 0) + 1;
      }
      return [key, limits];
    })),
    coverage: snapshot.coverage.map(({ periods: _periods, indicatorCoverage: _indicators, ...coverage }) => coverage),
    rpi: snapshot.rpi,
    modeA: { grain: 'admitted station × source month', tierPopulation: Object.fromEntries(['A', 'B', 'C'].map(tier => [tier, candidates.filter(candidate => candidate.eligible && candidate.tier === tier).length])), scenarios },
    modeB: { strictEligible: strictB.eligiblePopulation, strictExcluded: strictB.excludedPopulation, limitedEligible: limitedB.eligiblePopulation, limitedSelectedIds: limitedB.selectedIds, limitedPairCount: snapshot.totals.matchedPairCount, scope: 'Limited same-label exact monthly differences; historical physical continuity and sampling method remain unverified.' },
    modeC: { available: false, blockers: briefing.modeCEvidenceBlockers },
    comparison: comparePolicyScenarios(baseline, runPolicyScenario(candidates, 'balanced', 5)),
    sensitivity: { latestYear, latestYearOnly: comparePolicyScenarios(baseline, latest), capacity10: comparePolicyScenarios(baseline, runPolicyScenario(candidates, 'gaps', 10)) },
    sizes: { snapshotBytes: Buffer.byteLength(bytes), snapshotGzipBytes: gzipSync(bytes).length, jsonBriefingBytes: Buffer.byteLength(json), csvBriefingBytes: Buffer.byteLength(csv) },
    limitations: snapshot.limitations,
  };
  await writeFile('docs/river-water-policy-results.json', `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify({ totals: results.totals, tiers: results.modeA.tierPopulation, sizes: results.sizes, snapshotId: pointer.snapshotId }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
