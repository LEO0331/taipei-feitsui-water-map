import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { auditRiverWaterPolicySources, inspectRiverPolicyCsv, type RiverPolicyManifest } from './auditRiverWaterPolicySources';
import { riverIndicatorKeys, type RiverIndicatorKey } from '../src/types/riverWaterQuality';
import { parseRiverWaterQualityValue, riverColumnMap } from '../src/utils/riverWaterQuality';
import { POLICY_METHOD, type PolicyComparison, type PolicyCoverage, type PolicyPointer, type PolicyQualifiers, type PolicyRow, type PolicySnapshot, type PolicySource } from '../src/types/riverWaterPolicy';
import { classifyPolicyRow, observedPolicyRow, RPI_BLOCKERS, RPI_KEYS, validPolicyValue, validatePolicySnapshot } from '../src/utils/riverWaterPolicy';
import { buildPolicyCandidates, runPolicyScenario, comparePolicyScenarios } from '../src/utils/riverWaterPolicyScenarios';

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const emptyQualifiers = (): PolicyQualifiers => ({ measured: 0, not_detected_below: 0, not_measured: 0, missing: 0, unparsed: 0, invalid: 0, exactEligible: 0 });
function qualifierCounts(rows: PolicyRow[]): Record<RiverIndicatorKey, PolicyQualifiers> {
  return Object.fromEntries(riverIndicatorKeys.map(key => {
    const count = emptyQualifiers();
    for (const row of rows) {
      const cell = row.values[key]; count[cell.qualifier] += 1;
      if (cell.qualifier === 'measured' && !validPolicyValue(cell, key)) count.invalid += 1;
      if (observedPolicyRow(row) && validPolicyValue(cell, key)) count.exactEligible += 1;
    }
    return [key, count];
  })) as Record<RiverIndicatorKey, PolicyQualifiers>;
}
export function policyRowsFromCsv(source: PolicySource, csvRows: Record<string, string>[], stations: PolicySnapshot['stations'], analysisDate: string): PolicyRow[] {
  const rows = csvRows.map((raw, index): PolicyRow => {
    const month = Number(raw['月份']);
    const period = `${source.year}-${String(month).padStart(2, '0')}`;
    const riverName = raw['河川名稱'], stationName = raw['監測站'];
    const station = stations.find(s => s.riverName === riverName && s.stationName === stationName);
    if (!station) throw new Error(`Unadmitted station identity: ${riverName}/${stationName}`);
    const values = Object.fromEntries(riverIndicatorKeys.map(key => [key, parseRiverWaterQualityValue(raw[riverColumnMap[key].column], riverColumnMap[key].unit)])) as PolicyRow['values'];
    const issues: string[] = [];
    if (!Number.isInteger(month) || month < 1 || month > 12 || source.year !== source.yearRoc + 1911) issues.push('invalid_period');
    if (station.identityStatus !== 'label_verified') issues.push('identity_unverified');
    if (station.physicalContinuity !== 'verified') issues.push('historical_location_unverified');
    if (riverIndicatorKeys.some(key => values[key].qualifier === 'unparsed')) issues.push('unparsed_value');
    if (riverIndicatorKeys.some(key => values[key].qualifier === 'measured' && !validPolicyValue(values[key], key))) issues.push('invalid_value');
    if (riverIndicatorKeys.some(key => values[key].qualifier === 'not_detected_below')) issues.push('censored_value');
    const status = issues.includes('invalid_period') ? 'unparseable' : classifyPolicyRow(values, period, analysisDate);
    if (status === 'partially_observed') issues.push('partial_measurement');
    if (status === 'historical_missing') issues.push('historical_missing');
    if (period > analysisDate.slice(0, 7) && status !== 'future_placeholder') issues.push('future_measurement');
    const completeFourIndicators = ['valid_observed', 'partially_observed'].includes(status) && RPI_KEYS.every(key => validPolicyValue(values[key], key));
    if (!completeFourIndicators) issues.push('missing_rpi_inputs');
    issues.push('sampling_method_unknown');
    return { id: `${source.sourceId}:${source.sha256}:${index + 2}:${period}:${encodeURIComponent(riverName)}:${encodeURIComponent(stationName)}`, sourceId: source.sourceId, sourceSha256: source.sha256, rowNumber: index + 2, yearRoc: source.yearRoc, year: source.year, month, period, riverName, stationName, stationId: station.stationId, identityStatus: station.identityStatus, status, values, issues, completeFourIndicators, rpiEligible: false };
  });
  const identities = new Map<string, PolicyRow[]>();
  for (const row of rows) {
    const key = `${row.stationId}:${row.period}`;
    identities.set(key, [...(identities.get(key) ?? []), row]);
  }
  for (const group of identities.values()) if (group.length > 1) for (const row of group) {
    row.status = 'duplicate'; row.completeFourIndicators = false; row.issues.push('duplicate_period');
  }
  return rows;
}
export function buildPolicyComparisons(rows: PolicyRow[], stations: PolicySnapshot['stations'], years: number[]): PolicyComparison[] {
  const comparisons: PolicyComparison[] = [];
  for (const station of stations) for (let index = 1; index < years.length; index += 1) for (const indicator of riverIndicatorKeys) {
    const fromYear = years[index - 1], toYear = years[index];
    const pairs: PolicyComparison['pairs'] = [];
    for (let month = 1; month <= 12; month += 1) {
      const from = rows.filter(row => row.stationId === station.stationId && row.year === fromYear && row.month === month);
      const to = rows.filter(row => row.stationId === station.stationId && row.year === toYear && row.month === month);
      if (from.length !== 1 || to.length !== 1 || !observedPolicyRow(from[0]) || !observedPolicyRow(to[0]) || !validPolicyValue(from[0].values[indicator], indicator) || !validPolicyValue(to[0].values[indicator], indicator) || from[0].values[indicator].unit !== to[0].values[indicator].unit) continue;
      const fromValue = from[0].values[indicator].value!, toValue = to[0].values[indicator].value!;
      pairs.push({ month, fromId: from[0].id, toId: to[0].id, fromValue, toValue, change: toValue - fromValue });
    }
    const exclusionReasons = ['historical_location_unverified', 'sampling_method_unknown'];
    if (station.identityStatus !== 'label_verified') exclusionReasons.push('identity_unverified');
    if (pairs.length < 12) exclusionReasons.push('incomplete_matched_year');
    if (!pairs.length) exclusionReasons.push('no_exact_pairs');
    comparisons.push({ id: `${station.stationId}:${indicator}:${fromYear}-${toYear}`, stationId: station.stationId, riverName: station.riverName, stationName: station.stationName, indicator, fromYear, toYear, matchedCount: pairs.length, excludedCount: 12 - pairs.length, pairs, strictEligible: false, limitedEligible: station.identityStatus === 'label_verified' && pairs.length > 0, exclusionReasons });
  }
  return comparisons;
}
export async function buildRiverWaterPolicySnapshot(root = process.cwd(), publish = true) {
  const manifest: RiverPolicyManifest = await auditRiverWaterPolicySources(root);
  const rows: PolicyRow[] = [];
  const sources: PolicySource[] = [];
  const stations = manifest.stationAudit;
  for (const source of [...manifest.sources].sort((a, b) => a.year - b.year)) {
    const parsed = inspectRiverPolicyCsv(await readFile(path.resolve(root, source.localPath)), source.year, manifest.analysisDate);
    // Local source paths and historical internal filenames are excluded from browser/export provenance.
    const { localPath: _local, historicalComparison: _historical, ...publicSource } = source;
    sources.push(publicSource);
    rows.push(...policyRowsFromCsv(source, parsed.rows, stations, manifest.analysisDate));
  }
  rows.sort((a, b) => a.year - b.year || a.month - b.month || a.stationId.localeCompare(b.stationId, 'en') || a.rowNumber - b.rowNumber);
  const years = sources.map(source => source.year);
  const coverage: PolicyCoverage[] = stations.map(station => {
    const stationRows = rows.filter(row => row.stationId === station.stationId);
    const periods = years.flatMap(year => Array.from({ length: 12 }, (_, index) => {
      const period = `${year}-${String(index + 1).padStart(2, '0')}`, group = stationRows.filter(row => row.period === period);
      return { period, rowIds: group.map(row => row.id), status: group[0]?.status ?? 'absent' as const, expected: period <= manifest.analysisDate.slice(0, 7) };
    }));
    return { stationId: station.stationId, riverName: station.riverName, stationName: station.stationName, firstPeriod: periods[0].period, lastPeriod: periods.at(-1)!.period,
      expectedStationMonthCount: periods.filter(p => p.expected).length,
      publishedRowCount: stationRows.length, observedRowCount: stationRows.filter(observedPolicyRow).length,
      missingStationMonthCount: periods.filter(p => p.expected && !p.rowIds.some(id => stationRows.some(row => row.id === id && observedPolicyRow(row)))).length,
      placeholderCount: stationRows.filter(row => row.status === 'future_placeholder').length,
      partiallyMeasuredRowCount: stationRows.filter(row => row.status === 'partially_observed').length,
      completeFourIndicatorCount: stationRows.filter(row => row.completeFourIndicators).length,
      futureOpportunityCount: periods.filter(p => !p.expected).length, indicatorCoverage: qualifierCounts(stationRows), periods };
  });
  const qualifierTotals = qualifierCounts(rows), comparisons = buildPolicyComparisons(rows, stations, years);
  const completeInputCount = rows.filter(row => row.completeFourIndicators).length;
  const snapshot: PolicySnapshot = {
    schemaVersion: '1.0.0', methodId: POLICY_METHOD, analysisDate: manifest.analysisDate, sources, stations, rows, coverage, qualifierCounts: qualifierTotals, comparisons,
    context: manifest.context.map(({ localPath: _local, ...context }) => context),
    rpi: { available: false, label: 'Research-reproduced RPI', completeInputCount, eligibleCount: 0, excludedCount: rows.length, blockers: RPI_BLOCKERS, officialMethodUrl: 'https://wq.moenv.gov.tw/EWQP/zh/Encyclopedia/NounDefinition/Pedia_37.aspx' },
    totals: { publishedRowCount: rows.length, observedRowCount: rows.filter(observedPolicyRow).length, completeFourIndicatorCount: completeInputCount,
      partiallyMeasuredRowCount: rows.filter(row => row.status === 'partially_observed').length,
      placeholderCount: rows.filter(row => row.status === 'future_placeholder').length,
      futurePlaceholderCount: rows.filter(row => row.status === 'future_placeholder').length,
      expectedStationMonthCount: coverage.reduce((sum, item) => sum + item.expectedStationMonthCount, 0),
      missingStationMonthCount: coverage.reduce((sum, item) => sum + item.missingStationMonthCount, 0),
      censoredValueCount: riverIndicatorKeys.reduce((sum, key) => sum + qualifierTotals[key].not_detected_below, 0),
      duplicateCount: rows.filter(row => row.status === 'duplicate').length,
      unparseableRowCount: rows.filter(row => row.status === 'unparseable').length,
      strictComparisonCount: comparisons.filter(c => c.strictEligible).length,
      limitedComparisonCount: comparisons.filter(c => c.limitedEligible).length,
      matchedPairCount: comparisons.filter(c => c.limitedEligible).reduce((sum, c) => sum + c.matchedCount, 0) },
    limitations: [
      'Monthly station records support documentary evidence review only. They do not establish causality, regulatory compliance, drinking-water safety, ecological harm or current conditions.',
      'Expected periods assume the published monthly schedule across the admitted years. Station commissioning/discontinuation and historical physical continuity are unknown; missing rows do not prove closure.',
      'The current month is an observation opportunity still in progress; its empty rows are neither future placeholders nor overdue historical samples. Future months are excluded from expected-to-date denominators.',
      'Current official label matching does not establish unchanged historical physical monitoring location or laboratory methodology. Strict Mode B has no admitted comparisons. Limited pairs describe exact same-label monthly differences only, not validated trends or significance.',
      'Censored values preserve detection limits without substitution. No ordinary mean mixes exact and censored observations. No station coordinates are admitted and no policy map pins are generated.',
      'Complete four-indicator inputs are potential inputs only; research RPI remains unavailable pending precision, rounding and common-sampling evidence.',
    ],
  };
  const candidates = buildPolicyCandidates(snapshot);
  const scenarios = (['gaps', 'balanced'] as const).flatMap(strategy => ([5, 10, 'all'] as const).map(capacity => runPolicyScenario(candidates, strategy, capacity)));
  const latest = runPolicyScenario(buildPolicyCandidates(snapshot, { years: [Math.max(...years)] }), 'gaps', 5);
  snapshot.analysis = { candidates, scenarios: scenarios.map(({ selected: _selected, excluded, ...summary }) => ({ ...summary, excludedIds: excluded.map(candidate => candidate.id) })), sensitivity: { baselineConfig: { years }, alternativeConfig: { years: [Math.max(...years)] }, comparison: comparePolicyScenarios(scenarios[0], latest) } };
  if (!validatePolicySnapshot(snapshot)) throw new Error('Generated policy snapshot did not pass validation');
  const bytes = `${JSON.stringify(snapshot)}\n`, sha256 = hash(bytes);
  const pointer: PolicyPointer = { schemaVersion: '1.0.0', methodId: POLICY_METHOD, snapshotId: `sha256-${sha256}`, sha256, byteLength: Buffer.byteLength(bytes), file: `snapshots/${sha256}.json` };
  if (publish) {
    const output = path.join(root, 'public/data/river-water-policy');
    await mkdir(path.join(output, 'snapshots'), { recursive: true });
    const immutable = path.join(output, pointer.file);
    try { await writeFile(immutable, bytes, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await readFile(immutable, 'utf8') !== bytes) throw error; }
    // Publish only after complete validation and immutable-byte creation; failed rebuilds retain last pointer.
    const temporary = path.join(output, `current.${process.pid}.tmp`);
    await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`);
    await rename(temporary, path.join(output, 'current.json'));
  }
  return { snapshot, pointer, bytes };
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/buildRiverWaterPolicySnapshot.ts')) buildRiverWaterPolicySnapshot().then(({ snapshot, pointer }) => console.log(`${pointer.snapshotId}: ${snapshot.totals.publishedRowCount} published; ${snapshot.totals.observedRowCount} observed; ${snapshot.totals.futurePlaceholderCount} future placeholders`)).catch(error => { console.error(error); process.exitCode = 1; });
