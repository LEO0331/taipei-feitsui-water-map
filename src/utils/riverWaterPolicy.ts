import { riverIndicatorKeys, type RiverIndicatorKey, type RiverWaterQualityValue } from '../types/riverWaterQuality';
import { POLICY_METHOD, type PolicyPointer, type PolicyRow, type PolicyRowStatus, type PolicySnapshot } from '../types/riverWaterPolicy';
import { riverColumnMap } from './riverWaterQuality';
import { buildPolicyCandidates, comparePolicyScenarios, runPolicyScenario } from './riverWaterPolicyScenarios';

export const RPI_KEYS: RiverIndicatorKey[] = ['dissolvedOxygenMgL', 'biochemicalOxygenDemandMgL', 'suspendedSolidsMgL', 'ammoniaNitrogenMgL'];
export const RPI_BLOCKERS = [
  'Official reference specifies category points and averaging but leaves precision intervals (DO 4.5–4.6, BOD5 4.9–5.0, SS 49.9–50.0, NH3-N 0.99–1.00) unresolved for arbitrary decimal inputs.',
  'The applicable official laboratory significant-digit and RPI rounding rule has not been independently admitted. No rounding or detection-limit substitution is invented.',
  'Same station-month CSV fields establish a published monthly record, not an independently verified common sampling event. No official RPI value was matched.',
];
export function validPolicyValue(value: RiverWaterQualityValue, indicator: RiverIndicatorKey): boolean {
  if (value.qualifier !== 'measured' || !Number.isFinite(value.value) || value.unit !== riverColumnMap[indicator].unit) return false;
  if (indicator === 'ph') return value.value! >= 0 && value.value! <= 14;
  if (indicator === 'airTemperatureC' || indicator === 'waterTemperatureC') return true;
  return value.value! >= 0;
}
export function classifyPolicyRow(values: PolicyRow['values'], period: string, analysisDate: string): PolicyRowStatus {
  const observed = riverIndicatorKeys.filter(key => validPolicyValue(values[key], key) || (values[key].qualifier === 'not_detected_below' && Number.isFinite(values[key].detectionLimit) && values[key].detectionLimit! > 0)).length;
  const future = period > analysisDate.slice(0, 7);
  if (riverIndicatorKeys.some(key => values[key].qualifier === 'unparsed' || values[key].qualifier === 'measured' && !validPolicyValue(values[key], key) || values[key].qualifier === 'not_detected_below' && (!Number.isFinite(values[key].detectionLimit) || values[key].detectionLimit! <= 0))) return 'unparseable';
  if (future) return observed ? 'unparseable' : 'future_placeholder';
  if (observed === riverIndicatorKeys.length) return 'valid_observed';
  if (observed) return 'partially_observed';
  if (period < analysisDate.slice(0, 7)) return 'historical_missing';
  return 'present_no_indicators';
}
export const observedPolicyRow = (row: PolicyRow) => ['valid_observed', 'partially_observed'].includes(row.status);

/** Exact official table points only. Undefined values stay unavailable, including table precision gaps. */
export function officialRpiPoints(indicator: RiverIndicatorKey, value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  if (indicator === 'dissolvedOxygenMgL') return value >= 6.5 ? 1 : value >= 4.6 ? 3 : value <= 4.5 && value >= 2 ? 6 : value < 2 ? 10 : undefined;
  if (indicator === 'biochemicalOxygenDemandMgL') return value <= 3 ? 1 : value <= 4.9 ? 3 : value >= 5 && value <= 15 ? 6 : value > 15 ? 10 : undefined;
  if (indicator === 'suspendedSolidsMgL') return value <= 20 ? 1 : value <= 49.9 ? 3 : value >= 50 && value <= 100 ? 6 : value > 100 ? 10 : undefined;
  if (indicator === 'ammoniaNitrogenMgL') return value <= 0.5 ? 1 : value <= 0.99 ? 3 : value >= 1 && value <= 3 ? 6 : value > 3 ? 10 : undefined;
  return undefined;
}

export function validatePolicyPointer(value: unknown): value is PolicyPointer {
  if (!value || typeof value !== 'object') return false;
  const p = value as PolicyPointer;
  return p.schemaVersion === '1.0.0' && p.methodId === POLICY_METHOD && /^[a-f0-9]{64}$/.test(p.sha256) && p.snapshotId === `sha256-${p.sha256}` && p.file === `snapshots/${p.sha256}.json` && Number.isSafeInteger(p.byteLength) && p.byteLength > 0 && p.byteLength <= 30_000_000;
}
function policySnapshotStructureValid(value: unknown): value is PolicySnapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as PolicySnapshot;
  if (s.schemaVersion !== '1.0.0' || s.methodId !== POLICY_METHOD || !/^\d{4}-\d{2}-\d{2}$/.test(s.analysisDate) || new Date(s.analysisDate).toISOString().slice(0, 10) !== s.analysisDate || !Array.isArray(s.sources) || s.sources.length !== 4 || !Array.isArray(s.rows) || !Array.isArray(s.stations) || !Array.isArray(s.coverage) || !Array.isArray(s.comparisons) || !s.totals || !s.qualifierCounts || !s.rpi || s.rpi.available !== false || !Array.isArray(s.rpi.blockers) || !s.rpi.blockers.length || !Array.isArray(s.limitations)) return false;
  const sources = new Map(s.sources.map(source => [source.sourceId, source]));
  const stations = new Map(s.stations.map(station => [station.stationId, station]));
  if (sources.size !== 4 || stations.size !== s.stations.length || new Set(s.sources.map(source => source.year)).size !== 4 || new Set(s.rows.map(row => row.id)).size !== s.rows.length) return false;
  if (s.sources.some(source => !/^[a-f0-9]{64}$/.test(source.sha256) || !source.resourceId || source.datasetId !== '759db528-77b5-4aa3-b6fa-2b857890214e' || source.downloadUrl !== `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${source.resourceId}` || source.year !== source.yearRoc + 1911 || source.admissionStatus !== 'accepted' || !Array.isArray(source.columns) || riverIndicatorKeys.some(key => !source.columns.includes(riverColumnMap[key].column)))) return false;
  if (s.stations.some(station => !station.stationId || !['label_verified', 'unmatched', 'ambiguous'].includes(station.identityStatus) || !['verified', 'unverified'].includes(station.physicalContinuity))) return false;
  for (const row of s.rows) {
    const source = sources.get(row.sourceId);
    if (!source || source.sha256 !== row.sourceSha256 || !stations.has(row.stationId) || row.year !== source.year || !Number.isInteger(row.month) || row.month < 1 || row.month > 12 || row.period !== `${row.year}-${String(row.month).padStart(2, '0')}` || !row.id.startsWith(`${row.sourceId}:${source.sha256}:`) || !Array.isArray(row.issues) || row.rpiEligible !== false || !row.values) return false;
    for (const key of riverIndicatorKeys) {
      const cell = row.values[key];
      if (!cell || !['measured', 'not_detected_below', 'not_measured', 'missing', 'unparsed'].includes(cell.qualifier) || (cell.qualifier === 'measured' && !Number.isFinite(cell.value)) || (cell.qualifier !== 'measured' && cell.value !== undefined) || (cell.qualifier === 'not_detected_below' && (!Number.isFinite(cell.detectionLimit) || cell.detectionLimit! <= 0))) return false;
    }
    if (row.status !== 'duplicate' && row.status !== 'unparseable' && row.status !== classifyPolicyRow(row.values, row.period, s.analysisDate)) return false;
  }
  const rowMap = new Map(s.rows.map(row => [row.id, row]));
  for (const row of s.rows) {
    const station = stations.get(row.stationId)!;
    if (row.yearRoc !== row.year - 1911 || row.stationName !== station.stationName || row.riverName !== station.riverName || row.identityStatus !== station.identityStatus || row.completeFourIndicators !== (observedPolicyRow(row) && RPI_KEYS.every(key => validPolicyValue(row.values[key], key)))) return false;
    if (riverIndicatorKeys.some(key => row.values[key].unit !== riverColumnMap[key].unit)) return false;
    const duplicate = s.rows.filter(other => other.stationId === row.stationId && other.period === row.period).length > 1;
    if (row.status !== (duplicate ? 'duplicate' : classifyPolicyRow(row.values, row.period, s.analysisDate))) return false;
  }
  if (new Set(s.comparisons.map(c => c.id)).size !== s.comparisons.length) return false;
  for (const c of s.comparisons) {
    const station = stations.get(c.stationId);
    if (!station || !riverIndicatorKeys.includes(c.indicator) || c.riverName !== station.riverName || c.stationName !== station.stationName || c.toYear !== c.fromYear + 1 || !s.sources.some(source => source.year === c.fromYear) || !s.sources.some(source => source.year === c.toYear) || !Array.isArray(c.pairs) || c.matchedCount !== c.pairs.length || c.excludedCount !== 12 - c.pairs.length || c.strictEligible !== false || c.limitedEligible !== (station.identityStatus === 'label_verified' && c.pairs.length > 0) || new Set(c.pairs.map(p => p.month)).size !== c.pairs.length) return false;
    for (const p of c.pairs) {
      const from = rowMap.get(p.fromId), to = rowMap.get(p.toId);
      if (!from || !to || from.stationId !== c.stationId || to.stationId !== c.stationId || from.year !== c.fromYear || to.year !== c.toYear || from.month !== p.month || to.month !== p.month || !observedPolicyRow(from) || !observedPolicyRow(to) || !validPolicyValue(from.values[c.indicator], c.indicator) || !validPolicyValue(to.values[c.indicator], c.indicator) || p.fromValue !== from.values[c.indicator].value || p.toValue !== to.values[c.indicator].value || p.change !== p.toValue - p.fromValue) return false;
    }
  }
  for (const key of riverIndicatorKeys) {
    const expected = { measured: 0, not_detected_below: 0, not_measured: 0, missing: 0, unparsed: 0, invalid: 0, exactEligible: 0 };
    for (const row of s.rows) {
      expected[row.values[key].qualifier] += 1;
      if (row.values[key].qualifier === 'measured' && !validPolicyValue(row.values[key], key)) expected.invalid += 1;
      if (observedPolicyRow(row) && validPolicyValue(row.values[key], key)) expected.exactEligible += 1;
    }
    if (Object.entries(expected).some(([name, count]) => s.qualifierCounts[key][name as keyof typeof expected] !== count)) return false;
  }
  if (s.coverage.length !== s.stations.length || new Set(s.coverage.map(c => c.stationId)).size !== s.coverage.length) return false;
  for (const coverage of s.coverage) {
    const rows = s.rows.filter(row => row.stationId === coverage.stationId);
    if (!stations.has(coverage.stationId) || coverage.publishedRowCount !== rows.length || coverage.observedRowCount !== rows.filter(observedPolicyRow).length || coverage.placeholderCount !== rows.filter(row => row.status === 'future_placeholder').length || coverage.expectedStationMonthCount !== coverage.periods.filter(p => p.expected).length) return false;
    for (const period of coverage.periods) if (period.expected !== (period.period <= s.analysisDate.slice(0, 7)) || JSON.stringify(period.rowIds) !== JSON.stringify(rows.filter(row => row.period === period.period).map(row => row.id))) return false;
  }
  if (!(s.totals.publishedRowCount === s.rows.length && s.totals.observedRowCount === s.rows.filter(observedPolicyRow).length && s.totals.completeFourIndicatorCount === s.rows.filter(row => row.completeFourIndicators).length && s.totals.strictComparisonCount === 0 && s.totals.limitedComparisonCount === s.comparisons.filter(c => c.limitedEligible).length && s.rpi.eligibleCount === 0 && s.rpi.completeInputCount === s.totals.completeFourIndicatorCount && s.rpi.excludedCount === s.rows.length)) return false;
  const statusCount = (status: PolicyRowStatus) => s.rows.filter(row => row.status === status).length;
  if (s.totals.partiallyMeasuredRowCount !== statusCount('partially_observed') || s.totals.placeholderCount !== statusCount('future_placeholder') || s.totals.futurePlaceholderCount !== statusCount('future_placeholder') || s.totals.duplicateCount !== statusCount('duplicate') || s.totals.unparseableRowCount !== statusCount('unparseable') || s.totals.censoredValueCount !== riverIndicatorKeys.reduce((sum, key) => sum + s.qualifierCounts[key].not_detected_below, 0) || s.totals.expectedStationMonthCount !== s.coverage.reduce((sum, c) => sum + c.expectedStationMonthCount, 0) || s.totals.missingStationMonthCount !== s.coverage.reduce((sum, c) => sum + c.missingStationMonthCount, 0) || s.totals.matchedPairCount !== s.comparisons.filter(c => c.limitedEligible).reduce((sum, c) => sum + c.matchedCount, 0)) return false;
  if (!s.analysis) return false;
  const candidates = buildPolicyCandidates(s);
  const scenarios = (['gaps', 'balanced'] as const).flatMap(strategy => ([5, 10, 'all'] as const).map(capacity => runPolicyScenario(candidates, strategy, capacity)));
  const summaries = scenarios.map(({ selected: _selected, excluded, ...summary }) => ({ ...summary, excludedIds: excluded.map(c => c.id) }));
  const years = s.sources.map(source => source.year), latestYear = Math.max(...years);
  const sensitivity = { baselineConfig: { years }, alternativeConfig: { years: [latestYear] }, comparison: comparePolicyScenarios(scenarios[0], runPolicyScenario(buildPolicyCandidates(s, { years: [latestYear] }), 'gaps', 5)) };
  return JSON.stringify(s.analysis.candidates) === JSON.stringify(candidates) && JSON.stringify(s.analysis.scenarios) === JSON.stringify(summaries) && JSON.stringify(s.analysis.sensitivity) === JSON.stringify(sensitivity);
}
export function validatePolicySnapshot(value: unknown): value is PolicySnapshot {
  try { return policySnapshotStructureValid(value); } catch { return false; }
}

export async function verifyPolicyBytes(pointer: unknown, bytes: ArrayBuffer | Uint8Array): Promise<PolicySnapshot> {
  if (!validatePolicyPointer(pointer)) throw new Error('Invalid snapshot pointer');
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength !== pointer.byteLength) throw new Error('Snapshot byte length mismatch');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>))].map(b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== pointer.sha256) throw new Error('Snapshot hash mismatch');
  const snapshot: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
  if (!validatePolicySnapshot(snapshot)) throw new Error('Unsupported snapshot content');
  return snapshot;
}

export async function loadPolicySnapshot(baseUrl: string, signal?: AbortSignal): Promise<{ snapshot: PolicySnapshot; pointer: PolicyPointer }> {
  const response = await fetch(`${baseUrl}data/river-water-policy/current.json`, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const pointer: unknown = await response.json();
  if (!validatePolicyPointer(pointer)) throw new Error('Invalid snapshot pointer');
  const snapshotResponse = await fetch(`${baseUrl}data/river-water-policy/${pointer.file}`, { signal, cache: 'no-cache' });
  if (!snapshotResponse.ok) throw new Error(`HTTP ${snapshotResponse.status}`);
  return { pointer, snapshot: await verifyPolicyBytes(pointer, await snapshotResponse.arrayBuffer()) };
}
