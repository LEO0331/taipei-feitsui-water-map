import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { preparednessResources } from './auditPreparednessSources';
import type { PreparednessInventory, PreparednessSnapshot, PreparednessSource } from '../src/types/preparedness';
import { convertTwd97ToWgs84 } from '../src/utils/pumpingStations';
import { geometryIdentity, geometryIssue, inTaipeiBounds, normalizeEventDate, parsePreparednessKml, preparednessDistrict } from '../src/utils/preparednessSpatial';

const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
async function replaceOutput(temporary: string, target: string) {
  for (let attempt = 0; ; attempt += 1) {
    try { await rename(temporary, target); return; }
    catch (error) {
      if (attempt >= 4 || !['EPERM', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await delay(100 * (attempt + 1)); // Windows indexers/readers can briefly hold an otherwise valid output.
    }
  }
}
export function preparednessCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Unclosed CSV field');
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  const headers = rows.shift()?.map((s) => s.replace(/^\uFEFF/, ''));
  if (!headers?.length || new Set(headers).size !== headers.length) throw new Error('Missing/duplicate CSV headers');
  return rows.map((values) => { if (values.length !== headers.length) throw new Error('CSV field count mismatch'); return Object.fromEntries(headers.map((h, i) => [h, values[i]])); });
}
type ManifestEntry = { sourceId: string; datasetId: string; resourceId: string; sourceUrl: string; publicationDate: string; version: string; localPath: string; sourceSha256: string; byteLength: number; retrievedAt: string };
type QualityIssue = { sourceId: string; recordIndex: number; reasons: string[] };
export function validatePreparednessSnapshot(snapshot: PreparednessSnapshot): void {
  if (snapshot.schemaVersion !== '1.0.0' || snapshot.methodologyVersion !== 'heavy-rain-preparedness-review-v1' || !/^sha256-[a-f0-9]{16}$/.test(snapshot.snapshotVersion)) throw new Error('Invalid snapshot version');
  const sources = new Set(snapshot.sources.map((s) => s.sourceId));
  if (sources.size !== snapshot.sources.length || snapshot.sources.some((s) => !/^[a-f0-9]{64}$/.test(s.sourceSha256) || !s.datasetId || !s.version)) throw new Error('Invalid source identity/hash');
  if (new Set(snapshot.inventory.map((r) => r.id)).size !== snapshot.inventory.length) throw new Error('Duplicate published identity');
  if (snapshot.inventory.some((r) => !sources.has(r.sourceId) || (r.coordinateStatus === 'verified' && !inTaipeiBounds(r.longitude!, r.latitude!)))) throw new Error('Invalid inventory source/coordinate');
  if (snapshot.reviewAreas.some((r) => !sources.has(r.sourceId) || r.sourceId !== 'flood-prone' || geometryIssue(r.geometry))) throw new Error('Geometry/source mismatch');
  // Public input is deliberately constructed from an allowlist. This check catches accidental future broad spreads.
  const forbidden = /responsibleOfficerName|mobilePhone|officePhone|contractorName|sourceValues|\bADDRESS\b|\bEMAN\b|\bEFIRM\b/;
  if (forbidden.test(JSON.stringify(snapshot))) throw new Error('Personal/contact or household attributes in public decision snapshot');
}
export async function buildPreparednessDecisionSnapshot(root = process.cwd(), publish = true) {
  const manifest: { schemaVersion: string; auditedAt: string; sources: ManifestEntry[] } = JSON.parse(await readFile(path.join(root, 'data/raw/preparedness-decision/source-manifest.json'), 'utf8'));
  const requiredIds = ['pumping', 'machinery', 'basin', 'flood-prone', 'historical-inundation'];
  if (manifest.schemaVersion !== '1.0.0' || manifest.sources.length !== 5 || requiredIds.some((id) => manifest.sources.filter((s) => s.sourceId === id).length !== 1) || manifest.sources.some((s) => !s.version || !s.resourceId || !/^https:\/\/data\.taipei\/api\//.test(s.sourceUrl))) throw new Error('Unsupported source manifest/version');
  if (manifest.sources.find((s) => s.sourceId === 'machinery')?.version !== '115年度/2026') throw new Error('Mixed or unsupported machinery edition');
  for (const entry of manifest.sources) {
    const expected = preparednessResources.find((s) => s.sourceId === entry.sourceId)!;
    if (entry.datasetId !== expected.datasetId || entry.resourceId !== expected.resourceId || entry.version !== expected.version || entry.publicationDate !== expected.publicationDate || entry.sourceUrl !== `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${expected.resourceId}`) throw new Error('Source identity/version does not match audited resource selection');
  }
  const inventory: PreparednessInventory[] = [], sources: PreparednessSource[] = [], reviewAreas: PreparednessSnapshot['reviewAreas'] = [], issues: QualityIssue[] = [];
  const historical = new Map<string, { count: number; dates: Set<string> }>();
  const temporalCoverage: Record<string, { start: string | null; end: string | null }> = {};
  for (const entry of manifest.sources) {
    const absolute = path.resolve(root, entry.localPath);
    if (!absolute.startsWith(path.resolve(root, 'data/raw') + path.sep)) throw new Error('Source path outside raw directory');
    let bytes: Buffer;
    try { bytes = await readFile(absolute); } catch (error) {
      if (entry.sourceId !== 'flood-prone' && entry.sourceId !== 'historical-inundation') throw error;
      sources.push({ ...publicSource(entry), status: 'unavailable', recordCount: 0, rejectedCount: 0, limitations: ['Selected official KML bytes unavailable; no substitute geometry generated.'] }); continue;
    }
    if (hash(bytes) !== entry.sourceSha256 || bytes.length !== entry.byteLength) throw new Error(`${entry.sourceId}: source byte/hash mismatch; previous-good output preserved`);
    const source: PreparednessSource = { ...publicSource(entry), status: 'verified', recordCount: 0, rejectedCount: 0, limitations: [] };
    if (['pumping', 'machinery', 'basin'].includes(entry.sourceId)) {
      const utf8 = bytes.toString('utf8');
      const rows = preparednessCsv(utf8.includes('行政') || utf8.includes('TOWN_NAME') ? utf8 : new TextDecoder('big5').decode(bytes));
      const identities = new Set<string>();
      for (const [index, row] of rows.entries()) {
        const kind = entry.sourceId as 'pumping' | 'machinery' | 'basin';
        const get = (...names: string[]) => names.map((n) => row[n]).find((v) => v !== undefined)?.trim() ?? '';
        const identity = kind === 'pumping' ? get('NO') : kind === 'basin' ? get('POOL_CODE', 'POOL_CODE(沉砂池編號)') : get('OBJECTID（編號）', 'OBJECTID');
        const name = kind === 'pumping' ? get('站名') : kind === 'basin' ? get('POOL_NAME', 'POOL_NAME(地點)') : get('ENGINEID（外租機械編號）', 'ENGINEID');
        if (!identity || !name) throw new Error(`${kind}: required source facility identity missing (schema mismatch)`);
        if (identities.has(identity)) { issues.push({ sourceId: kind, recordIndex: index + 1, reasons: ['duplicate_identity'] }); source.rejectedCount += 1; continue; }
        identities.add(identity);
        const district = preparednessDistrict(kind === 'pumping' ? get('行政區域') : kind === 'basin' ? get('TOWN_NAME', 'TOWN_NAME(行政區)') : get('DISTRICT（行政區）', 'DISTRICT'));
        const x = kind === 'machinery' ? get('Longitude') : get('X坐標'), y = kind === 'machinery' ? get('Latitude') : get('Y坐標');
        let point: { longitude: number; latitude: number } | undefined;
        if (x && y && Number.isFinite(Number(x)) && Number.isFinite(Number(y))) point = kind === 'machinery' ? { longitude: Number(x), latitude: Number(y) } : convertTwd97ToWgs84(Number(x), Number(y));
        // Stabilize projection floating-point tails across Node/OS versions (about 1 mm).
        // Official WGS84 coordinates remain at their original source precision.
        if (point && kind !== 'machinery') point = { longitude: Number(point.longitude.toFixed(8)), latitude: Number(point.latitude.toFixed(8)) };
        const coordinateStatus = !x || !y ? 'missing' : point && inTaipeiBounds(point.longitude, point.latitude) ? 'verified' : 'invalid';
        const qualityFlags = ['operational_status_unknown', 'catchment_relationship_unverified'];
        if (coordinateStatus !== 'verified') qualityFlags.push(coordinateStatus === 'missing' ? 'missing_coordinate' : 'invalid_coordinate');
        if (!district) qualityFlags.push('unknown_district');
        if (kind === 'pumping' && !/^\d{8}$/.test(get('建置日期'))) qualityFlags.push('missing_established_date');
        if (kind === 'machinery' && !normalizeEventDate(get('SPRECDATE'))) qualityFlags.push('missing_record_date');
        inventory.push({ id: `${kind}:${identity}`, sourceId: kind, assetType: kind, district, name, ...(coordinateStatus === 'verified' ? point : {}), coordinateStatus, qualityFlags });
        const findings = qualityFlags.filter((f) => !['operational_status_unknown', 'catchment_relationship_unverified'].includes(f));
        if (findings.length) issues.push({ sourceId: kind, recordIndex: index + 1, reasons: findings });
      }
      source.recordCount = inventory.filter((i) => i.sourceId === entry.sourceId).length;
      source.limitations = ['Inventory records do not verify operating condition, present availability or service coverage.'];
      if (entry.sourceId === 'basin') source.limitations.push('Catchment area unit is not stated in the selected CSV header or catalogue; omitted from decision inputs. Catchment area is not detention volume.');
      if (entry.sourceId === 'machinery') source.limitations.push('Only the official 115年度/2026 edition is used; 2025 edition is excluded. No personal or contractor attributes retained.');
    } else {
      const parsed = parsePreparednessKml(bytes.toString('utf8')), seen = new Set<string>(), dates: string[] = [];
      for (const feature of parsed) {
        const district = preparednessDistrict(feature.attributes[entry.sourceId === 'flood-prone' ? 'DISTRICT' : 'TOWN_NAME'] ?? '');
        const reasons = [...feature.issues]; if (!district) reasons.push('unknown_district');
        const date = entry.sourceId === 'historical-inundation' ? normalizeEventDate(feature.attributes.FDATE ?? '') : null;
        if (entry.sourceId === 'historical-inundation' && !date) reasons.push('invalid_event_date');
        const key = hash(JSON.stringify([district, date, feature.geometry ? geometryIdentity(feature.geometry) : null]));
        if (seen.has(key)) reasons.push('duplicate_observation_geometry');
        if (!reasons.length) seen.add(key);
        if (reasons.length || !feature.geometry || !district) { issues.push({ sourceId: entry.sourceId, recordIndex: feature.index, reasons }); source.rejectedCount += 1; continue; }
        if (entry.sourceId === 'flood-prone') reviewAreas.push({ id: `reference:${key.slice(0, 16)}`, sourceId: entry.sourceId, district, geometry: feature.geometry });
        else { const group = historical.get(district) ?? { count: 0, dates: new Set<string>() }; group.count += 1; group.dates.add(date!); historical.set(district, group); dates.push(date!); }
        source.recordCount += 1;
      }
      dates.sort(); temporalCoverage[entry.sourceId] = { start: dates[0] ?? null, end: dates.at(-1) ?? null }; source.temporalCoverage = temporalCoverage[entry.sourceId];
      source.status = source.rejectedCount ? 'limited' : 'verified';
      source.limitations = ['WGS84 KML source precision; coordinate bounds are a sanity check, not administrative boundary verification. District labels are source attributes, not independently surveyed boundaries.', 'Self-intersection, ring and planar component intersection/containment checks applied. Holes and touching or overlapping components are excluded conservatively. Historical/reference geometry is not a present-day flood forecast.'];
      if (entry.sourceId === 'flood-prone') source.limitations.push('Published reference areas do not cover every district; absence is not evidence of no flood susceptibility.');
      else source.limitations.push(`Publication date is not event coverage. Validated observation dates: ${dates[0] ?? 'unknown'} through ${dates.at(-1) ?? 'unknown'}, including observations before catalogue coverage start 2015-05-01. Document title 1140307 differs from catalogue update 2026-09-30; catalogue coverage end 2026-09-11 does not establish observations through that date. Counts represent polygon observations; distinct dates are not unique storm events. Depth/area units not independently confirmed and not scored. Household addresses and historical polygons are not republished.`);
      if (!source.recordCount) source.status = 'unavailable';
    }
    if (source.rejectedCount && source.status === 'verified') source.status = 'limited';
    sources.push(source);
  }
  const snapshot: PreparednessSnapshot = {
    schemaVersion: '1.0.0', methodologyVersion: 'heavy-rain-preparedness-review-v1', snapshotVersion: 'sha256-0000000000000000', processedAt: manifest.auditedAt,
    sources, inventory, reviewAreas, historicalByDistrict: [...historical].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([district, value]) => ({ district, sourceId: 'historical-inundation', observationCount: value.count, distinctDateCount: value.dates.size, eventDates: [...value.dates].sort() })),
    limitations: ['Independent engineering POC for documentary review, not emergency instructions, flood predictions, operational readiness certification or dispatch.', 'No rainfall, reservoir level, asset age, capacity or distance-based protection inference contributes to review priorities.', 'Missing infrastructure records or historical polygons do not establish absence of protection or zero review need.'],
    geographyReason: 'District-level documentary review: official reference polygons have incomplete district coverage and no catchment-to-inventory identity relationship has been adopted. Polygons are context only; no artificial district boundaries or proximity linkage are inferred.',
    floodContextAvailable: sources.some((s) => ['flood-prone', 'historical-inundation'].includes(s.sourceId) && s.recordCount > 0 && s.status !== 'unavailable'),
  };
  snapshot.snapshotVersion = `sha256-${hash(JSON.stringify(snapshot)).slice(0, 16)}`;
  validatePreparednessSnapshot(snapshot);
  const report = { schemaVersion: '1.0.0', snapshotVersion: snapshot.snapshotVersion, processedAt: snapshot.processedAt, sources: sources.map((s) => ({ sourceId: s.sourceId, validCount: s.recordCount, rejectedCount: s.rejectedCount })), temporalCoverage, issues, limitations: ['Issues list refers to source row/placemark indices without personal data. Infrastructure documentary gaps are retained; invalid flood geometries/dates are excluded from aggregation and maps.'] };
  if (publish) {
    const out = path.join(root, 'public/data/preparedness-decision'); await mkdir(out, { recursive: true });
    // The browser consumes one cohesive snapshot. Validation completes before any output is touched.
    for (const [file, data] of Object.entries({ 'source-health.json': sources, 'review-areas.json': reviewAreas, 'evidence-summary.json': { snapshotVersion: snapshot.snapshotVersion, historicalByDistrict: snapshot.historicalByDistrict, inventoryCounts: sources.filter((s) => ['pumping', 'machinery', 'basin'].includes(s.sourceId)).map((s) => ({ sourceId: s.sourceId, count: s.recordCount })) }, 'conversion-report.json': report, 'snapshot.json': snapshot })) {
      const target = path.join(out, file), temporary = `${target}.tmp`; await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`); await replaceOutput(temporary, target);
    }
  }
  return { snapshot, report };
}
function publicSource(entry: ManifestEntry): Omit<PreparednessSource, 'status' | 'recordCount' | 'rejectedCount' | 'limitations'> {
  return { sourceId: entry.sourceId, datasetId: entry.datasetId, resourceId: entry.resourceId, sourceUrl: entry.sourceUrl, publicationDate: entry.publicationDate, retrievedAt: entry.retrievedAt, sourceSha256: entry.sourceSha256, version: entry.version,
    publisher: '臺北市政府工務局水利工程處', coordinateSystem: ['pumping', 'basin'].includes(entry.sourceId) ? 'EPSG:3826' : 'EPSG:4326', sourceSchema: ['flood-prone', 'historical-inundation'].includes(entry.sourceId) ? 'KML 2.2 Polygon/MultiGeometry' : entry.sourceId === 'machinery' ? 'CSV 115年度 ENGINEID/OBJECTID/DISTRICT/Longitude/Latitude' : entry.sourceId === 'pumping' ? 'CSV NO/站名/行政區域/X坐標/Y坐標' : 'CSV POOL_CODE/POOL_NAME/TOWN_NAME/X坐標/Y坐標', temporalCoverage: { start: null, end: null } };
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/buildPreparednessDecisionSnapshot.ts')) buildPreparednessDecisionSnapshot().then(({ snapshot }) => console.log(`Preparedness ${snapshot.snapshotVersion}: ${snapshot.inventory.length} inventory records, ${snapshot.reviewAreas.length} reference polygons`)).catch((error) => { console.error(error); process.exitCode = 1; });
