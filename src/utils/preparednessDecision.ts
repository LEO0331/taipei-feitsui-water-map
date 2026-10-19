import type { PreparednessSnapshot, PreparednessSource } from '../types/preparedness';
import { geometryIssue, inTaipeiBounds, TAIPEI_DISTRICTS } from './preparednessSpatial';

export const DISTRICTS = TAIPEI_DISTRICTS;
export type AssetType = 'pumping' | 'machinery' | 'basin';
export type Scenario = 'gaps' | 'balanced' | 'flood';
export type Capacity = number | 'unlimited';
export type DecisionConfig = {
  version: '1.0.0'; mode: 'evidence' | 'flood'; districts: string[]; assetTypes: AssetType[];
  evidenceRequirement: 'strict' | 'permissive'; includeStaleSources: boolean; staleAfterDays: number;
};
export const DEFAULT_CONFIG: DecisionConfig = {
  version: '1.0.0', mode: 'evidence', districts: [], assetTypes: [],
  evidenceRequirement: 'strict', includeStaleSources: true, staleAfterDays: 730,
};
export type EvidenceGap = { code: string; dimension: string; sourceId: string; sourceIds: string[]; question: string };
export type Candidate = {
  id: string; district: string; assetType: AssetType; tier: 'A' | 'B' | 'C' | 'insufficient';
  gaps: EvidenceGap[]; sourceIds: string[]; verifiedSourceTypes: string[]; recordCount: number;
  officialContext: boolean; officialDesignation: boolean; historicalObservations: number; reasons: string[]; eligible: boolean;
  excludedReasons: string[]; ageDays: number | null; versionUncertain: boolean; scopeKey: string;
};
export type ScenarioResult = {
  scenario: Scenario; capacity: Capacity; selected: Candidate[]; excluded: Candidate[]; ranked: Candidate[];
  gapCount: number; districtCount: number; sourceTypes: string[]; scopeKey: string; unavailableReason: string | null;
};
const unique = (items: string[]) => [...new Set(items)].sort();
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const geometryShapeValid = (geometry: PreparednessSnapshot['reviewAreas'][number]['geometry']) => {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const shapeValid = polygons.length > 0 && polygons.every(polygon => Array.isArray(polygon) && polygon.length > 0 && polygon.every(ring =>
    Array.isArray(ring) && ring.length >= 4 && ring.every(point => Array.isArray(point) && point.length === 2 && inTaipeiBounds(point[0], point[1])) &&
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]));
  return shapeValid && geometryIssue(geometry) === null;
};
const sourceAge = (source: PreparednessSource, snapshot: PreparednessSnapshot) => {
  if (!source.publicationDate) return null;
  const age = (Date.parse(snapshot.processedAt) - Date.parse(source.publicationDate)) / 86400000;
  return Number.isFinite(age) && age >= 0 ? Math.floor(age) : null;
};
const supported = (source: PreparednessSource | undefined, config: DecisionConfig, snapshot: PreparednessSnapshot) =>
  !!source && !!source.datasetId && !!source.resourceId && !!source.sourceSha256 && !!source.version &&
  (source.status === 'verified' || (config.evidenceRequirement === 'permissive' && source.status === 'limited')) &&
  (config.includeStaleSources || (sourceAge(source, snapshot) !== null && sourceAge(source, snapshot)! <= config.staleAfterDays));

export function resolveConfig(config: Partial<DecisionConfig> = {}): DecisionConfig {
  const result = { ...DEFAULT_CONFIG, ...config, districts: [...(config.districts ?? [])], assetTypes: [...(config.assetTypes ?? [])] };
  if (!Number.isFinite(result.staleAfterDays) || result.staleAfterDays < 0) throw new Error('Invalid source age threshold');
  if (result.districts.some(d => !DISTRICTS.includes(d))) throw new Error('Unknown district');
  if (result.assetTypes.some(t => !['pumping', 'machinery', 'basin'].includes(t))) throw new Error('Unknown infrastructure category');
  if (!['evidence', 'flood'].includes(result.mode) || !['strict', 'permissive'].includes(result.evidenceRequirement) || result.version !== '1.0.0') throw new Error('Unsupported decision configuration');
  return result;
}

/** Runtime boundary for downloaded JSON. The ETL performs the detailed GIS/source audit. */
export function validateDecisionSnapshot(value: unknown): value is PreparednessSnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as PreparednessSnapshot;
  return s.schemaVersion === '1.0.0' && s.methodologyVersion === 'heavy-rain-preparedness-review-v1' &&
    typeof s.snapshotVersion === 'string' && Number.isFinite(Date.parse(s.processedAt)) &&
    typeof s.geographyReason === 'string' && typeof s.floodContextAvailable === 'boolean' &&
    Array.isArray(s.limitations) && s.limitations.every(x => typeof x === 'string') &&
    Array.isArray(s.sources) && new Set(s.sources.map(x => x?.sourceId)).size === s.sources.length &&
    s.sources.every(x => x && typeof x.sourceId === 'string' && typeof x.version === 'string' &&
      typeof x.datasetId === 'string' && typeof x.sourceSha256 === 'string' && typeof x.sourceUrl === 'string' &&
      (x.resourceId === null || typeof x.resourceId === 'string') && ['verified', 'limited', 'unavailable'].includes(x.status) &&
      Number.isInteger(x.recordCount) && x.recordCount >= 0 && Number.isInteger(x.rejectedCount) && x.rejectedCount >= 0 &&
      Array.isArray(x.limitations) && x.limitations.every(l => typeof l === 'string') &&
      (x.status === 'unavailable' || /^[a-f0-9]{64}$/i.test(x.sourceSha256)) &&
      (x.retrievedAt === null || (typeof x.retrievedAt === 'string' && Number.isFinite(Date.parse(x.retrievedAt)))) &&
      (x.publicationDate === null || (typeof x.publicationDate === 'string' && Number.isFinite(Date.parse(x.publicationDate))))) &&
    Array.isArray(s.inventory) && s.inventory.every(x => x && typeof x.id === 'string' && typeof x.sourceId === 'string' &&
      typeof x.name === 'string' && x.sourceId === x.assetType && s.sources.some(source => source.sourceId === x.sourceId) &&
      ['pumping', 'machinery', 'basin'].includes(x.assetType) && (x.district === null || typeof x.district === 'string') &&
      ['verified', 'missing', 'invalid'].includes(x.coordinateStatus) && Array.isArray(x.qualityFlags) && x.qualityFlags.every(f => typeof f === 'string') &&
      (x.coordinateStatus !== 'verified' || inTaipeiBounds(x.longitude!, x.latitude!))) &&
    Array.isArray(s.reviewAreas) && s.reviewAreas.every(x => x && typeof x.id === 'string' && typeof x.sourceId === 'string' &&
      x.sourceId === 'flood-prone' && s.sources.some(source => source.sourceId === x.sourceId) &&
      (x.district === null || DISTRICTS.includes(x.district)) && geometryShapeValid(x.geometry)) &&
    Array.isArray(s.historicalByDistrict) && s.historicalByDistrict.every(x => x && DISTRICTS.includes(x.district) && typeof x.sourceId === 'string' &&
      x.sourceId === 'historical-inundation' && s.sources.some(source => source.sourceId === x.sourceId) &&
      Number.isInteger(x.observationCount) && x.observationCount >= 0 && Number.isInteger(x.distinctDateCount) && x.distinctDateCount >= 0 &&
      Array.isArray(x.eventDates) && x.eventDates.every(date => typeof date === 'string' && Number.isFinite(Date.parse(date))));
}

export function buildCandidates(snapshot: PreparednessSnapshot, partial: Partial<DecisionConfig> = {}): Candidate[] {
  if (!validateDecisionSnapshot(snapshot)) throw new Error('Invalid preparedness snapshot schema');
  const config = resolveConfig(partial);
  const sourceMap = new Map(snapshot.sources.map(s => [s.sourceId, s]));
  const districts = DISTRICTS.filter(d => !config.districts.length || config.districts.includes(d));
  const types = (['pumping', 'machinery', 'basin'] as AssetType[]).filter(t => !config.assetTypes.length || config.assetTypes.includes(t));
  const scopeKey = JSON.stringify({ snapshot: snapshot.snapshotVersion, sources: snapshot.sources.map(s => [s.sourceId, s.resourceId, s.version, s.sourceSha256, s.publicationDate, s.status]).sort(), districts, types, mode: config.mode, requirement: config.evidenceRequirement, includeStale: config.includeStaleSources, staleAfterDays: config.staleAfterDays });
  return districts.flatMap(district => types.map(assetType => {
    const source = sourceMap.get(assetType);
    const usable = supported(source, config, snapshot);
    const records = snapshot.inventory.filter(r => r.district === district && r.assetType === assetType && r.sourceId === assetType);
    const contexts = unique([
      ...snapshot.reviewAreas.filter(a => a.district === district).map(a => a.sourceId),
      ...snapshot.historicalByDistrict.filter(a => a.district === district && a.observationCount > 0).map(a => a.sourceId),
    ]).filter(id => supported(sourceMap.get(id), config, snapshot) &&
      (sourceMap.get(id)?.status === 'verified' || (id === 'historical-inundation' && config.evidenceRequirement === 'permissive')));
    const officialContext = contexts.length > 0;
    const officialDesignation = contexts.includes('flood-prone');
    const gaps: EvidenceGap[] = [];
    const gap = (dimension: string, question: string) => gaps.push({ code: dimension, dimension, sourceId: assetType, sourceIds: [assetType], question });
    const flags = new Set(records.flatMap(r => r.qualityFlags));
    const ageDays = source ? sourceAge(source, snapshot) : null;
    const versionUncertain = !source?.version || /unknown|uncertain|unverified/i.test(source.version) || flags.has('source_version_uncertain');
    if (!usable) gap('source_failure', 'Verify source identity, version, availability and eligibility before using this inventory.');
    else {
      if (!records.length) gap('inventory_coverage', 'Confirm the geographic coverage of this inventory; no recorded facilities does not establish absence of protection.');
      if (records.some(r => r.coordinateStatus !== 'verified') || flags.has('duplicate_identity') || flags.has('invalid_coordinate')) gap('identity_geography', 'Verify facility identity and coordinates; multiple fields from this source-integrity concern count once.');
      if (ageDays === null || ageDays > config.staleAfterDays || versionUncertain || flags.has('missing_record_date') || flags.has('missing_established_date')) gap('temporal_version', 'Confirm the source period and version; publication or establishment dates do not establish equipment condition.');
      if (records.length && flags.has('operational_status_unknown')) gap('operational_evidence', 'Request current inspection and availability evidence; unknown availability is not equipment failure.');
      if (records.length && flags.has('catchment_relationship_unverified')) gap('service_relationship', 'Confirm an authoritative drainage-service relationship; proximity does not prove service or protection.');
    }
    const floodUnavailable = config.mode === 'flood' && (!snapshot.floodContextAvailable || !snapshot.sources.some(s => ['flood-prone', 'historical-inundation'].includes(s.sourceId) &&
      (s.status === 'verified' || (s.sourceId === 'historical-inundation' && config.evidenceRequirement === 'permissive')) && supported(s, config, snapshot)));
    const excludedReasons = [!usable ? 'Essential infrastructure source identity or eligible source version is unavailable.' : '', floodUnavailable ? 'Official validated flood context is unavailable under these evidence filters.' : ''].filter(Boolean);
    const eligible = excludedReasons.length === 0;
    const tier: Candidate['tier'] = !eligible ? 'insufficient' : officialDesignation && gaps.length >= 2 ? 'A' : officialContext || gaps.length > 0 ? 'B' : 'C';
    const sourceIds = unique([...(usable ? [assetType] : []), ...contexts]);
    return { id: `${district}:${assetType}`, district, assetType, tier, gaps, sourceIds,
      verifiedSourceTypes: sourceIds.filter(id => sourceMap.get(id)?.status === 'verified'), recordCount: usable ? records.length : 0,
      officialContext, officialDesignation, historicalObservations: snapshot.historicalByDistrict.filter(h => h.district === district && contexts.includes(h.sourceId)).reduce((n, h) => n + h.observationCount, 0),
      reasons: [tier === 'A' ? 'Official reference context and at least two independent evidence questions.' : tier === 'B' ? 'Official reference context or a material documentary question.' : tier === 'C' ? 'Source-backed routine inventory review.' : 'Essential evidence is insufficient.', ...gaps.map(g => g.question)],
      eligible, excludedReasons, ageDays, versionUncertain, scopeKey };
  }));
}

function rank(a: Candidate, b: Candidate) {
  const tiers = { A: 0, B: 1, C: 2, insufficient: 3 };
  return tiers[a.tier] - tiers[b.tier] || b.gaps.length - a.gaps.length ||
    b.verifiedSourceTypes.length - a.verifiedSourceTypes.length || Number(b.versionUncertain) - Number(a.versionUncertain) ||
    (b.ageDays ?? -1) - (a.ageDays ?? -1) || compareText(a.id, b.id);
}

export function runScenario(candidates: Candidate[], scenario: Scenario, capacity: Capacity): ScenarioResult {
  if (!['gaps', 'balanced', 'flood'].includes(scenario)) throw new Error('Unknown scenario');
  if (capacity !== 'unlimited' && (!Number.isSafeInteger(capacity) || capacity <= 0)) throw new Error('Review capacity must be a positive integer or unlimited');
  const keys = unique(candidates.map(c => c.scopeKey));
  if (keys.length > 1) throw new Error('Candidates must share one evidence scope');
  let ranked = candidates.filter(c => c.eligible).sort(rank);
  let unavailableReason: string | null = null;
  if (scenario === 'flood') {
    ranked = ranked.filter(c => c.officialContext);
    if (!ranked.length) unavailableReason = 'No eligible official flood-context candidates in this evidence scope.';
  }
  if (scenario === 'balanced') {
    const groups = new Map<string, Candidate[]>();
    for (const candidate of ranked) groups.set(candidate.district, [...(groups.get(candidate.district) ?? []), candidate]);
    // District order follows each district's highest-ranked candidate, then stable ID.
    const districtOrder = [...groups.keys()].sort((a, b) => rank(groups.get(a)![0], groups.get(b)![0]) || compareText(a, b));
    const balanced: Candidate[] = [];
    const rounds = Math.max(0, ...[...groups.values()].map(g => g.length));
    for (let i = 0; i < rounds; i++) for (const district of districtOrder) if (groups.get(district)![i]) balanced.push(groups.get(district)![i]);
    ranked = balanced;
  }
  const selected = ranked.slice(0, capacity === 'unlimited' ? ranked.length : capacity);
  const ids = new Set(selected.map(c => c.id));
  return { scenario, capacity, selected, excluded: candidates.filter(c => !ids.has(c.id)).sort(rank), ranked,
    gapCount: selected.reduce((n, c) => n + c.gaps.length, 0), districtCount: new Set(selected.map(c => c.district)).size,
    sourceTypes: unique(selected.flatMap(c => c.verifiedSourceTypes)), scopeKey: keys[0] ?? '', unavailableReason };
}

export function compareScenarios(left: ScenarioResult, right: ScenarioResult) {
  const oldIds = new Set(left.selected.map(c => c.id));
  const newIds = new Set(right.selected.map(c => c.id));
  const sameEvidenceScope = left.scopeKey === right.scopeKey;
  return { sameEvidenceScope, stableIds: [...oldIds].filter(id => newIds.has(id)).sort(),
    addedIds: [...newIds].filter(id => !oldIds.has(id)).sort(), removedIds: [...oldIds].filter(id => !newIds.has(id)).sort(),
    rankChanges: right.ranked.map((c, i) => ({ id: c.id, from: left.ranked.findIndex(x => x.id === c.id) + 1 || null, to: i + 1 })).filter(c => c.from !== c.to),
    notice: sameEvidenceScope ? 'Same source versions, geography and evidence population; differences reflect review assumptions or capacity.' : 'Different evidence scope: source/filter/geography changes must not be interpreted as a policy effect.' };
}

export function makeBriefing(snapshot: PreparednessSnapshot, partial: Partial<DecisionConfig>, scenario: Scenario, capacity: Capacity = 'unlimited') {
  const config = resolveConfig(partial);
  const candidates = buildCandidates(snapshot, config);
  const result = runScenario(candidates, scenario, capacity);
  return {
    title: 'Heavy-Rain Preparedness Review Briefing', decisionQuestion: 'Which district and infrastructure records should limited documentary or field-review slots examine first?',
    methodologyVersion: snapshot.methodologyVersion, configurationVersion: config.version, snapshotVersion: snapshot.snapshotVersion, processedAt: snapshot.processedAt,
    geography: 'district × infrastructure category', geographyReason: snapshot.geographyReason, config, result,
    sourceVersions: snapshot.sources.map(s => ({ sourceId: s.sourceId, datasetId: s.datasetId, resourceId: s.resourceId, sourceUrl: s.sourceUrl, version: s.version,
      publicationDate: s.publicationDate, retrievedAt: s.retrievedAt, sourceSha256: s.sourceSha256, status: s.status, recordCount: s.recordCount, rejectedCount: s.rejectedCount,
      limitations: [...s.limitations], publisher: s.publisher, coordinateSystem: s.coordinateSystem, sourceSchema: s.sourceSchema,
      temporalCoverage: s.temporalCoverage ? { start: s.temporalCoverage.start, end: s.temporalCoverage.end } : undefined })),
    officialContextInputsUsed: unique(result.selected.filter(c => c.officialContext).flatMap(c => c.sourceIds.filter(id => id === 'flood-prone' || id === 'historical-inundation'))),
    infrastructureInventory: (['pumping', 'machinery', 'basin'] as AssetType[]).map(assetType => ({ assetType, records: candidates.filter(c => c.assetType === assetType).reduce((n, c) => n + c.recordCount, 0) })),
    dataQualityFindings: candidates.flatMap(c => c.gaps.map(g => ({ candidateId: c.id, ...g }))),
    sensitivity: { capacity5vs10: compareScenarios(runScenario(candidates, scenario, 5), runScenario(candidates, scenario, 10)), gapsVsBalanced: compareScenarios(runScenario(candidates, 'gaps', capacity), runScenario(candidates, 'balanced', capacity)) },
    unknownOperationalConditions: ['Current equipment availability, maintenance condition, deployment readiness and functional drainage service are not established by this snapshot.'],
    verificationQuestions: unique(result.selected.flatMap(c => c.gaps.map(g => g.question))),
    limitations: [...snapshot.limitations, 'Review slots are hypothetical documentary/field-review capacity. Historical observations are not forecasts. Facility counts are not pumping capacity or protected communities. No emergency dispatch or readiness certification.'],
  };
}
export type Briefing = ReturnType<typeof makeBriefing>;

/** Quote every cell and neutralize leading whitespace/control characters before formula operators. */
export function csvCell(value: unknown): string {
  let cell = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(cell) || /^[\t\r\n]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
}
export function briefingCsv(briefing: Briefing): string {
  const metadata = JSON.stringify({ methodologyVersion: briefing.methodologyVersion, configurationVersion: briefing.configurationVersion,
    snapshotVersion: briefing.snapshotVersion, processedAt: briefing.processedAt, geography: briefing.geography, geographyReason: briefing.geographyReason,
    config: briefing.config, sourceVersions: briefing.sourceVersions, officialContextInputsUsed: briefing.officialContextInputsUsed,
    infrastructureInventory: briefing.infrastructureInventory, sensitivity: briefing.sensitivity, unknownOperationalConditions: briefing.unknownOperationalConditions, limitations: briefing.limitations });
  const header = ['candidate_id', 'district', 'infrastructure_category', 'selected', 'tier', 'record_count_not_capacity', 'independent_questions', 'verified_source_types', 'official_reference_context', 'explanation', 'excluded_reason', 'reproduction_context'];
  const selected = new Set(briefing.result.selected.map(c => c.id));
  return '\uFEFF' + [header, ...[...briefing.result.selected, ...briefing.result.excluded].map(c => [c.id, c.district, c.assetType, selected.has(c.id), c.tier, c.recordCount, c.gaps.length,
    c.verifiedSourceTypes.join(';'), c.officialContext, c.reasons.join(' | '), c.excludedReasons.join(' | ') || (selected.has(c.id) ? '' : 'Outside scenario focus or review capacity'), metadata])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
