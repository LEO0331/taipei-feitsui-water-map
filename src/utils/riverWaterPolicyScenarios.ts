import type { PolicyComparison, PolicyRow, PolicySnapshot } from '../types/riverWaterPolicy';
import { riverIndicatorKeys, type RiverIndicatorKey } from '../types/riverWaterQuality';

export type PolicyMode = 'A' | 'B' | 'C';
export type PolicyStrategy = 'gaps' | 'balanced';
export type PolicyCapacity = 5 | 10 | 'all';
export type PolicyConfig = {
  mode: PolicyMode;
  years: number[];
  rivers: string[];
  stations: string[];
  sourceIds: string[];
  indicator: 'all' | RiverIndicatorKey;
  evidence: 'strict' | 'limited';
};
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  mode: 'A', years: [], rivers: [], stations: [], sourceIds: [], indicator: 'all', evidence: 'strict',
};
export type PolicyCandidate = {
  id: string;
  kind: 'station_month' | 'indicator_comparison';
  stationId: string;
  riverName: string;
  stationName: string;
  period: string;
  years: number[];
  sourceIds: string[];
  rowIds: string[];
  indicator: 'all' | RiverIndicatorKey;
  tier: 'A' | 'B' | 'C';
  issueCodes: string[];
  eligible: boolean;
  exclusionReasons: string[];
  observedRowCount: number;
  publishedRowCount: number;
  qualifierCounts: Record<string, number>;
  excludedQualifierCounts: Record<string, number>;
  comparisonValidity: 'not_applicable' | 'strict' | 'limited' | 'insufficient';
  matchedCount: number;
  excludedPairCount: number;
  rpiEligible: boolean;
};
export type PolicyScenario = {
  strategy: PolicyStrategy;
  capacity: PolicyCapacity;
  population: number;
  eligiblePopulation: number;
  eligibleIds: string[];
  excludedPopulation: number;
  selectedCount: number;
  selected: PolicyCandidate[];
  selectedIds: string[];
  excluded: PolicyCandidate[];
  unselectedIds: string[];
  rivers: string[];
  stations: string[];
  indicators: string[];
  tierCounts: Record<'A' | 'B' | 'C', number>;
  unusedCapacity: number;
  selectionReasons: Array<{ id: string; reason: string }>;
};
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const unique = (items: string[]) => [...new Set(items)].sort(compareText);
const primaryIssues = new Set(['duplicate_period', 'invalid_period', 'identity_ambiguous', 'identity_unmatched', 'contradictory_river', 'unparseable_essential', 'incompatible_schema', 'future_measurement']);
const observedStatuses = new Set(['valid_observed', 'partially_observed']);
const issueOrder = ['duplicate_period', 'invalid_period', 'identity_ambiguous', 'identity_unmatched', 'contradictory_river', 'unparseable_essential', 'incompatible_schema', 'future_measurement', 'unparsed_value', 'invalid_value', 'historical_missing', 'partial_measurement', 'missing_rpi_inputs', 'censored_value', 'identity_unverified', 'sampling_method_unknown', 'current_period_pending'];
const issueRank = (issue: string) => { const index = issueOrder.indexOf(issue); return index < 0 ? issueOrder.length : index; };
const sortIssues = (issues: string[]) => unique(issues).sort((a, b) => issueRank(a) - issueRank(b) || compareText(a, b));
const candidateOrder = (a: PolicyCandidate, b: PolicyCandidate) => compareText(a.tier, b.tier) || issueRank(a.issueCodes[0] ?? '') - issueRank(b.issueCodes[0] ?? '') || compareText(a.id, b.id);

export function resolvePolicyConfig(partial: Partial<PolicyConfig> = {}): PolicyConfig {
  const config = { ...DEFAULT_POLICY_CONFIG, ...partial };
  if (!['A', 'B', 'C'].includes(config.mode) || !['strict', 'limited'].includes(config.evidence) || (config.indicator !== 'all' && !riverIndicatorKeys.includes(config.indicator))) throw new Error('Unsupported policy configuration');
  if (!Array.isArray(config.years) || config.years.some(year => !Number.isInteger(year) || year < 1912 || year > 9999)) throw new Error('Invalid comparison years');
  for (const key of ['rivers', 'stations', 'sourceIds'] as const) if (!Array.isArray(config[key]) || config[key].some(item => typeof item !== 'string' || !item)) throw new Error(`Invalid ${key} filter`);
  return { ...config, years: [...new Set(config.years)].sort((a, b) => a - b), rivers: unique(config.rivers), stations: unique(config.stations), sourceIds: unique(config.sourceIds) };
}

function rowInScope(row: PolicyRow, config: PolicyConfig) {
  return (!config.years.length || config.years.includes(row.year)) && (!config.rivers.length || config.rivers.includes(row.riverName)) &&
    (!config.stations.length || config.stations.includes(row.stationId)) && (!config.sourceIds.length || config.sourceIds.includes(row.sourceId));
}

function fromRows(rows: PolicyRow[], config: PolicyConfig): PolicyCandidate {
  const first = rows[0];
  const issues = rows.flatMap(row => row.issues);
  if (rows.length > 1) issues.push('duplicate_period');
  if (rows.some(row => row.identityStatus === 'ambiguous')) issues.push('identity_ambiguous');
  if (rows.some(row => row.identityStatus === 'unmatched')) issues.push('identity_unmatched');
  if (rows.some(row => row.status === 'partially_observed')) issues.push('partial_measurement');
  if (rows.some(row => row.status === 'historical_missing')) issues.push('historical_missing');
  if (rows.some(row => row.status === 'present_no_indicators')) issues.push('current_period_pending');
  const keys = config.indicator === 'all' ? riverIndicatorKeys : [config.indicator];
  const qualifierCounts: Record<string, number> = {};
  for (const row of rows) for (const key of keys) {
    const qualifier = row.values[key].qualifier;
    qualifierCounts[qualifier] = (qualifierCounts[qualifier] ?? 0) + 1;
    if (qualifier === 'not_detected_below') issues.push('censored_value');
    if (qualifier === 'unparsed') issues.push('unparsed_value');
  }
  if (rows.some(row => !row.completeFourIndicators)) issues.push('missing_rpi_inputs');
  const issueCodes = sortIssues(issues);
  const future = rows.every(row => row.status === 'future_placeholder');
  // A future row is an explicitly excluded opportunity, never an overdue sample.
  const exclusionReasons = future ? ['future_placeholder_not_due'] : [];
  return {
    id: `A:${first.stationId}:${first.period}`,
    kind: 'station_month', stationId: first.stationId, riverName: first.riverName, stationName: first.stationName,
    period: first.period, years: [...new Set(rows.map(row => row.year))].sort(), sourceIds: unique(rows.map(row => row.sourceId)),
    rowIds: unique(rows.map(row => row.id)), indicator: config.indicator,
    tier: issueCodes.some(code => primaryIssues.has(code)) ? 'A' : issueCodes.length ? 'B' : 'C', issueCodes,
    eligible: !future, exclusionReasons, observedRowCount: rows.filter(row => observedStatuses.has(row.status)).length,
    publishedRowCount: rows.length, qualifierCounts, excludedQualifierCounts: {}, comparisonValidity: 'not_applicable', matchedCount: 0, excludedPairCount: 0,
    rpiEligible: rows.length === 1 && first.rpiEligible,
  };
}

function fromComparison(comparison: PolicyComparison, rows: Map<string, PolicyRow>, config: PolicyConfig): PolicyCandidate {
  const rowIds = unique(comparison.pairs.flatMap(pair => [pair.fromId, pair.toId]));
  const linked = rowIds.map(id => rows.get(id)).filter((row): row is PolicyRow => !!row);
  const pairedIds = new Set(rowIds);
  const qualifierCounts: Record<string, number> = {}, excludedQualifierCounts: Record<string, number> = {};
  for (const row of linked) {
    const qualifier = row.values[comparison.indicator].qualifier;
    qualifierCounts[qualifier] = (qualifierCounts[qualifier] ?? 0) + 1;
  }
  // Count the same indicator on the actual nonpaired published rows in this station/year window.
  // Missing calendar rows have no published cell and remain in excludedPairCount, not synthetic cells.
  for (const row of rows.values()) if (row.stationId === comparison.stationId && [comparison.fromYear, comparison.toYear].includes(row.year) &&
    !pairedIds.has(row.id) && (!config.sourceIds.length || config.sourceIds.includes(row.sourceId))) {
    const qualifier = row.values[comparison.indicator].qualifier;
    excludedQualifierCounts[qualifier] = (excludedQualifierCounts[qualifier] ?? 0) + 1;
  }
  const sourceIds = unique(linked.map(row => row.sourceId));
  const strict = comparison.strictEligible;
  const limited = comparison.limitedEligible;
  const filterExclusions: string[] = [];
  if (config.years.length && ![comparison.fromYear, comparison.toYear].every(year => config.years.includes(year))) filterExclusions.push('comparison_year_outside_scope');
  if (config.sourceIds.length && (!sourceIds.length || sourceIds.some(id => !config.sourceIds.includes(id)))) filterExclusions.push('comparison_source_outside_scope');
  if (linked.length !== rowIds.length) filterExclusions.push('missing_source_lineage');
  const eligible = (strict || (config.evidence === 'limited' && limited)) && !filterExclusions.length;
  return {
    id: `B:${comparison.id}`, kind: 'indicator_comparison', stationId: comparison.stationId,
    riverName: comparison.riverName, stationName: comparison.stationName,
    period: `${comparison.fromYear}/${comparison.toYear}`, years: [comparison.fromYear, comparison.toYear], sourceIds,
    rowIds, indicator: comparison.indicator, tier: strict ? 'C' : 'B', issueCodes: strict ? [] : sortIssues(comparison.exclusionReasons),
    eligible, exclusionReasons: eligible ? [] : unique([...comparison.exclusionReasons, ...filterExclusions, ...(config.evidence === 'strict' && !strict ? ['strict_comparison_evidence_insufficient'] : [])]),
    observedRowCount: linked.filter(row => observedStatuses.has(row.status)).length, publishedRowCount: linked.length,
    qualifierCounts, excludedQualifierCounts, comparisonValidity: strict ? 'strict' : limited ? 'limited' : 'insufficient',
    matchedCount: comparison.matchedCount, excludedPairCount: comparison.excludedCount, rpiEligible: false,
  };
}

export function buildPolicyCandidates(snapshot: PolicySnapshot, partial: Partial<PolicyConfig> = {}): PolicyCandidate[] {
  const config = resolvePolicyConfig(partial);
  if (config.mode === 'C') return [];
  if (config.mode === 'B') {
    const rowMap = new Map(snapshot.rows.map(row => [row.id, row]));
    return snapshot.comparisons.filter(comparison => (!config.rivers.length || config.rivers.includes(comparison.riverName)) &&
      (!config.stations.length || config.stations.includes(comparison.stationId)) && (config.indicator === 'all' || config.indicator === comparison.indicator))
      .map(comparison => fromComparison(comparison, rowMap, config)).sort(candidateOrder);
  }
  const grouped = new Map<string, PolicyRow[]>();
  for (const row of snapshot.rows.filter(row => rowInScope(row, config))) {
    const key = `${row.stationId}\u0000${row.period}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].map(rows => fromRows(rows.sort((a, b) => compareText(a.id, b.id)), config)).sort(candidateOrder);
}

export function runPolicyScenario(candidates: PolicyCandidate[], strategy: PolicyStrategy = 'gaps', capacity: PolicyCapacity = 5): PolicyScenario {
  if (!['gaps', 'balanced'].includes(strategy) || ![5, 10, 'all'].includes(capacity)) throw new Error('Unsupported strategy/capacity');
  if (new Set(candidates.map(candidate => candidate.id)).size !== candidates.length) throw new Error('Duplicate candidate identity');
  const eligible = candidates.filter(candidate => candidate.eligible).sort(candidateOrder);
  const limit = capacity === 'all' ? eligible.length : capacity;
  const selected: PolicyCandidate[] = [];
  const riverCounts = new Map<string, number>(), stationCounts = new Map<string, number>();
  for (const tier of ['A', 'B', 'C'] as const) {
    const pending = eligible.filter(candidate => candidate.tier === tier);
    while (pending.length && selected.length < limit) {
      if (strategy === 'balanced') pending.sort((a, b) => issueRank(a.issueCodes[0] ?? '') - issueRank(b.issueCodes[0] ?? '') || (riverCounts.get(a.riverName) ?? 0) - (riverCounts.get(b.riverName) ?? 0) ||
        (stationCounts.get(a.stationId) ?? 0) - (stationCounts.get(b.stationId) ?? 0) || candidateOrder(a, b));
      const candidate = pending.shift()!;
      selected.push(candidate);
      riverCounts.set(candidate.riverName, (riverCounts.get(candidate.riverName) ?? 0) + 1);
      stationCounts.set(candidate.stationId, (stationCounts.get(candidate.stationId) ?? 0) + 1);
    }
  }
  const selectedIds = selected.map(candidate => candidate.id), selectedSet = new Set(selectedIds);
  return {
    strategy, capacity, population: candidates.length, eligiblePopulation: eligible.length, eligibleIds: unique(eligible.map(candidate => candidate.id)), excludedPopulation: candidates.length - eligible.length,
    selectedCount: selected.length, selected, selectedIds,
    excluded: candidates.filter(candidate => !candidate.eligible).sort(candidateOrder),
    unselectedIds: eligible.filter(candidate => !selectedSet.has(candidate.id)).map(candidate => candidate.id),
    rivers: unique(selected.map(candidate => candidate.riverName)), stations: unique(selected.map(candidate => candidate.stationId)),
    indicators: unique(selected.map(candidate => candidate.indicator)),
    tierCounts: { A: selected.filter(candidate => candidate.tier === 'A').length, B: selected.filter(candidate => candidate.tier === 'B').length, C: selected.filter(candidate => candidate.tier === 'C').length },
    unusedCapacity: capacity === 'all' ? 0 : capacity - selected.length,
    selectionReasons: selected.map(candidate => ({ id: candidate.id, reason: `${strategy === 'balanced' ? 'tier_then_issue_then_least_represented_river_station' : 'tier_then_issue_precedence_stable_id'}:${candidate.tier}:${candidate.issueCodes.join('|') || 'routine_review'}` })),
  };
}

/** Compares actual selections; population changes are explicit and are never presented as strategy effects. */
export function comparePolicyScenarios(before: PolicyScenario, after: PolicyScenario) {
  const prior = new Set(before.selectedIds), next = new Set(after.selectedIds);
  const sameEligiblePopulation = JSON.stringify(before.eligibleIds) === JSON.stringify(after.eligibleIds);
  return {
    sameEligiblePopulation,
    sharedIds: unique(before.selectedIds.filter(id => next.has(id))), addedIds: unique(after.selectedIds.filter(id => !prior.has(id))), removedIds: unique(before.selectedIds.filter(id => !next.has(id))),
    eligiblePopulationChange: after.eligiblePopulation - before.eligiblePopulation,
    selectedCoverageChange: after.selectedCount - before.selectedCount,
    riverCoverageChange: after.rivers.length - before.rivers.length, stationCoverageChange: after.stations.length - before.stations.length,
    before: { eligiblePopulation: before.eligiblePopulation, selectedCount: before.selectedCount, rivers: before.rivers, stations: before.stations },
    after: { eligiblePopulation: after.eligiblePopulation, selectedCount: after.selectedCount, rivers: after.rivers, stations: after.stations },
    explanation: sameEligiblePopulation ? 'The exact eligible candidate IDs are identical. Selection changes reflect strategy or capacity under the supplied scope.' : 'Eligibility populations differ. Changes reflect scope or evidence rules as well as selection; this is not an equivalent-population strategy comparison.',
  };
}

export function policyCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Spreadsheets may ignore leading control/space characters before an executable prefix.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function makePolicyBriefing(snapshot: PolicySnapshot, config: Partial<PolicyConfig>, result: PolicyScenario, integrity: { snapshotId: string; sha256: string }) {
  if (!/^[a-f0-9]{64}$/.test(integrity.sha256) || integrity.snapshotId !== `sha256-${integrity.sha256}`) throw new Error('Verified snapshot integrity required for export');
  const resolved = resolvePolicyConfig(config);
  const replay = runPolicyScenario(buildPolicyCandidates(snapshot, resolved), result.strategy, result.capacity);
  if (JSON.stringify(replay) !== JSON.stringify(result)) throw new Error('Scenario does not match the exported snapshot and configuration');
  return {
    title: 'River Monitoring Evidence Review Briefing', policy: 13,
    method: 'river-water-longitudinal-evidence-review-v1', analysisDate: snapshot.analysisDate,
    ...integrity, sourceEditions: snapshot.sources.map(source => ({ sourceId: source.sourceId, year: source.year, sha256: source.sha256, resourceId: source.resourceId })),
    candidateGrain: resolved.mode === 'C' ? 'unavailable causal or regulatory conclusion' : resolved.mode === 'B' ? 'station × indicator × matched-year window' : 'station × source month',
    config: resolved, eligibilityCriteria: 'A: admitted published station-months except future placeholders. B strict: verified physical identity and exact compatible paired observations; limited: source-label pairs only. C: unavailable.',
    qualifierCountDefinitions: { qualifierCounts: 'A: scoped indicator cells on published candidate rows. B: selected indicator cells on distinct paired source rows.', excludedQualifierCounts: 'B: selected indicator cells on actual nonpaired published rows within the station/year/source window; absent calendar rows create no synthetic cells. A: not applicable.' },
    strategy: result.strategy, capacity: result.capacity, selectedIds: result.selectedIds, population: result.population,
    eligiblePopulation: result.eligiblePopulation, excludedPopulation: result.excludedPopulation, unusedCapacity: result.unusedCapacity,
    selectionReasons: result.selectionReasons, selected: result.selected, excluded: result.excluded, unselectedIds: result.unselectedIds,
    unselectedReason: 'Eligible candidates outside the deterministic capacity shortlist; not an evidence exclusion or environmental judgement.',
    representation: { rivers: result.rivers, stations: result.stations, indicators: result.indicators, tiers: result.tierCounts },
    limitations: snapshot.limitations,
    modeCEvidenceBlockers: ['No independent causal identification', 'No permit or official compliance determination', 'No validated public-health suitability assessment'],
  };
}

export type PolicyBriefing = ReturnType<typeof makePolicyBriefing>;
const MAX_EXPORT_BYTES = 12 * 1024 * 1024;
export function policyBriefingJson(briefing: PolicyBriefing): string {
  const output = `${JSON.stringify(briefing, null, 2)}\n`;
  if (new TextEncoder().encode(output).length > MAX_EXPORT_BYTES) throw new Error('Briefing exceeds export size limit');
  return output;
}
export function policyBriefingCsv(briefing: PolicyBriefing): string {
  const headers = ['policy', 'method', 'analysisDate', 'snapshotId', 'sha256', 'sourceEditions', 'config', 'strategy', 'capacity', 'candidateGrain', 'selectionStatus', 'id', 'riverName', 'stationName', 'stationId', 'period', 'sourceIds', 'rowIds', 'tier', 'issueCodes', 'eligible', 'exclusionReasons', 'observedRowCount', 'publishedRowCount', 'qualifierCounts', 'excludedQualifierCounts', 'qualifierCountDefinitions', 'comparisonValidity', 'matchedCount', 'excludedPairCount', 'rpiEligible', 'limitations'];
  const metadata = [briefing.policy, briefing.method, briefing.analysisDate, briefing.snapshotId, briefing.sha256, briefing.sourceEditions, briefing.config, briefing.strategy, briefing.capacity, briefing.candidateGrain];
  const rows: unknown[][] = [...briefing.selected.map(candidate => ({ candidate, status: 'selected' })), ...briefing.excluded.map(candidate => ({ candidate, status: 'excluded' }))]
    .map(({ candidate: c, status }) => [...metadata, status, c.id, c.riverName, c.stationName, c.stationId, c.period, c.sourceIds, c.rowIds, c.tier, c.issueCodes, c.eligible, c.exclusionReasons, c.observedRowCount, c.publishedRowCount, c.qualifierCounts, c.excludedQualifierCounts, briefing.qualifierCountDefinitions, c.comparisonValidity, c.matchedCount, c.excludedPairCount, c.rpiEligible, briefing.limitations]);
  if (!rows.length) rows.push([...metadata, 'empty_result', ...Array.from({ length: headers.length - metadata.length - 2 }, () => ''), briefing.limitations]);
  const output = `\uFEFF${[headers, ...rows].map(row => row.map(policyCsvCell).join(',')).join('\r\n')}\r\n`;
  if (new TextEncoder().encode(output).length > MAX_EXPORT_BYTES) throw new Error('Briefing exceeds export size limit');
  return output;
}
