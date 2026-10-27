import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { preparednessCsv } from './buildPreparednessDecisionSnapshot';
import { parseRiverWaterQualityValue, riverColumnMap } from '../src/utils/riverWaterQuality';
import { riverIndicatorKeys } from '../src/types/riverWaterQuality';

export const riverPolicyDatasetId = '759db528-77b5-4aa3-b6fa-2b857890214e';
export const riverPolicyCatalogueUrl = `https://data.taipei/dataset/detail?id=${riverPolicyDatasetId}`;
export const riverPolicyContextResources = [
  { sourceId: 'catalogue', sourceUrl: riverPolicyCatalogueUrl },
  { sourceId: 'station-context', sourceUrl: 'https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx' },
  { sourceId: 'rpi-definition', sourceUrl: 'https://wq.moenv.gov.tw/EWQP/zh/Encyclopedia/NounDefinition/Pedia_37.aspx' },
  { sourceId: 'rpi-support', sourceUrl: 'https://water.moenv.gov.tw/Public/CHT/WQInfo/monitor_river.aspx' },
];
export const riverPolicyHash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export type RiverPolicySource = {
  sourceId: string; datasetId: string; resourceId: string; catalogueUrl: string; downloadUrl: string;
  publisher: string; yearRoc: number; year: number; updatedAt: string; retrievedAt: string;
  localPath: string; sha256: string; byteLength: number; encoding: string; columns: string[];
  publishedRowCount: number; observedRowCount: number; placeholderCount: number;
  duplicateIdentities: string[]; qualifierCounts: Record<string, number>; admissionStatus: 'accepted';
  historicalComparison: { localPath: string; sha256: string; byteLength: number; identical: boolean };
};
export type RiverPolicyContext = { sourceId: string; sourceUrl: string; localPath: string; sha256: string; byteLength: number; retrievedAt: string };
export type RiverPolicyStation = {
  stationId: string; riverName: string; stationName: string; rawLabels: string[]; years: number[];
  identityStatus: 'label_verified' | 'ambiguous' | 'unmatched'; physicalContinuity: 'unverified';
  coordinateStatus: 'unverified'; evidenceUrls: string[]; limitations: string[];
};
export type RiverPolicyManifest = { schemaVersion: '1.0.0'; analysisDate: string; acceptedAt: string;
  sources: RiverPolicySource[]; context: RiverPolicyContext[]; stationAudit: RiverPolicyStation[] };

export function auditRiverPolicyStations(annual: Array<{ year: number; rows: Record<string, string>[] }>, html: string): RiverPolicyStation[] {
  const select = html.match(/<select[^>]*id="CPH_Content_ddl_site"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  if (!select) throw new Error('Official station dropdown unavailable');
  const officialLabels = new Set([...select.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map(m => m[1]));
  if (officialLabels.size !== 16) throw new Error('Official station roster changed; manual identity review required');
  const stations = new Map<string, RiverPolicyStation>();
  for (const { year, rows } of annual) for (const row of rows) {
    const riverName = row['河川名稱'], stationName = row['監測站'];
    const stationId = `station-${riverPolicyHash(`${riverName}\0${stationName}`).slice(0, 16)}`;
    if (!stations.has(stationId)) stations.set(stationId, {
      stationId, riverName, stationName, rawLabels: [stationName], years: [],
      identityStatus: officialLabels.has(stationName) ? 'label_verified' : 'unmatched',
      physicalContinuity: 'unverified', coordinateStatus: 'unverified',
      evidenceUrls: [riverPolicyCatalogueUrl, 'https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx'],
      limitations: ['Current station labels and repeated source river/station labels do not establish unchanged historical physical location, equipment or sampling method.', 'Commissioning/discontinuation dates and source-backed station coordinates are not admitted.', ...(!officialLabels.has(stationName) ? ['CSV 青礜溪 and current official 菁礐溪 differ; no alias is admitted without independent documentary evidence.'] : [])],
    });
    const station = stations.get(stationId)!;
    if (!station.years.includes(year)) station.years.push(year);
  }
  return [...stations.values()].sort((a, b) => a.stationId < b.stationId ? -1 : 1);
}

export function inspectRiverPolicyCsv(bytes: Buffer, year: number, analysisDate: string) {
  const utf8 = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const encoding = !utf8.includes('\uFFFD') ? 'UTF-8' : 'Big5/CP950';
  const text = encoding === 'UTF-8' ? utf8 : new TextDecoder('big5', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  const rows = preparednessCsv(text), columns = Object.keys(rows[0] ?? {});
  const required = ['序號', '月份', '河川名稱', '監測站', ...riverIndicatorKeys.map(k => riverColumnMap[k].column)];
  if (columns.length !== required.length || required.some(c => !columns.includes(c))) throw new Error('Annual CSV schema or indicator unit mismatch');
  if (!rows.length) throw new Error('Empty annual CSV');
  const seen = new Set<string>(), duplicateIdentities: string[] = [];
  const qualifierCounts: Record<string, number> = { measured: 0, not_detected_below: 0, not_measured: 0, missing: 0, unparsed: 0 };
  let observedRowCount = 0, placeholderCount = 0;
  for (const row of rows) {
    const month = Number(row['月份']);
    if (!row['河川名稱'] || !row['監測站'] || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid annual CSV identity or month');
    const identity = `${year}-${String(month).padStart(2, '0')}:${row['河川名稱']}:${row['監測站']}`;
    if (seen.has(identity)) duplicateIdentities.push(identity);
    seen.add(identity);
    const cells = riverIndicatorKeys.map(k => parseRiverWaterQualityValue(row[riverColumnMap[k].column], riverColumnMap[k].unit));
    cells.forEach(c => { qualifierCounts[c.qualifier] += 1; });
    const observed = cells.some(c => c.qualifier === 'measured' || c.qualifier === 'not_detected_below');
    if (observed) observedRowCount += 1;
    if (!observed && cells.every(c => c.qualifier === 'missing') && `${year}-${String(month).padStart(2, '0')}` > analysisDate.slice(0, 7)) placeholderCount += 1;
  }
  return { rows, columns, encoding, publishedRowCount: rows.length, observedRowCount, placeholderCount, duplicateIdentities, qualifierCounts };
}

export async function auditRiverWaterPolicySources(root = process.cwd(), manifest?: RiverPolicyManifest) {
  const accepted: RiverPolicyManifest = manifest ?? JSON.parse(await readFile(path.join(root, 'data/raw/river-water-policy/source-manifest.json'), 'utf8'));
  if (accepted.schemaVersion !== '1.0.0' || !/^\d{4}-\d{2}-\d{2}$/.test(accepted.analysisDate) || accepted.sources.length !== 4 || accepted.context.length !== 4) throw new Error('Unsupported source manifest');
  if (riverPolicyContextResources.some(expected => accepted.context.filter(c => c.sourceId === expected.sourceId && c.sourceUrl === expected.sourceUrl).length !== 1)) throw new Error('Official contextual source identity mismatch');
  if (new Set(accepted.sources.map(s => s.year)).size !== 4 || [2023, 2024, 2025, 2026].some(y => !accepted.sources.some(s => s.year === y))) throw new Error('Mixed annual editions');
  const safeRead = async (p: string) => {
    const absolute = path.resolve(root, p), raw = path.resolve(root, 'data/raw/river-water-policy') + path.sep;
    if (!absolute.startsWith(raw)) throw new Error('Source path outside scoped raw directory');
    return readFile(absolute);
  };
  for (const s of [...accepted.sources, ...accepted.context]) {
    const bytes = await safeRead(s.localPath);
    if (!/^[a-f0-9]{64}$/.test(s.sha256) || riverPolicyHash(bytes) !== s.sha256 || bytes.length !== s.byteLength) throw new Error(`${s.sourceId}: original byte/hash mismatch`);
  }
  const catalogue = accepted.context.find(c => c.sourceId === 'catalogue');
  if (!catalogue || catalogue.sourceUrl !== riverPolicyCatalogueUrl) throw new Error('Missing independent catalogue evidence');
  const html = (await safeRead(catalogue.localPath)).toString('utf8');
  const resources = catalogueResources(html);
  const annual = [];
  for (const s of accepted.sources) {
    const metadata = resources.find(r => r.year === s.year);
    if (!metadata || s.sourceId !== `river-${s.year}` || s.publisher !== '臺北市政府環境保護局' || s.datasetId !== riverPolicyDatasetId || s.yearRoc + 1911 !== s.year || s.catalogueUrl !== riverPolicyCatalogueUrl || s.resourceId !== metadata.resourceId || s.updatedAt !== metadata.updatedAt || s.downloadUrl !== `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${s.resourceId}` || s.admissionStatus !== 'accepted') throw new Error(`${s.sourceId}: catalogue identity/edition mismatch`);
    const actual = inspectRiverPolicyCsv(await safeRead(s.localPath), s.year, accepted.analysisDate);
    annual.push({ year: s.year, rows: actual.rows });
    for (const k of ['columns', 'publishedRowCount', 'observedRowCount', 'placeholderCount', 'duplicateIdentities', 'qualifierCounts', 'encoding'] as const) if (JSON.stringify(actual[k]) !== JSON.stringify(s[k])) throw new Error(`${s.sourceId}: audit metadata mismatch: ${k}`);
  }
  const stationContext = accepted.context.find(c => c.sourceId === 'station-context');
  if (!stationContext || stationContext.sourceUrl !== 'https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx') throw new Error('Missing official station context');
  const expectedStations = auditRiverPolicyStations(annual, (await safeRead(stationContext.localPath)).toString('utf8'));
  if (JSON.stringify(expectedStations) !== JSON.stringify(accepted.stationAudit)) throw new Error('Station audit differs from original official evidence');
  return accepted;
}

/** Decode Nuxt's reference table, deriving resource IDs and timestamps from each resource object. */
export function catalogueResources(html: string) {
  const json = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new Error('Official catalogue embedded metadata unavailable');
  const table: unknown[] = JSON.parse(json);
  const result: Array<{ year: number; yearRoc: number; resourceId: string; updatedAt: string; fileName: string }> = [];
  for (const item of table) {
    if (!item || Array.isArray(item) || typeof item !== 'object') continue;
    const entry = item as Record<string, number>;
    if (!('rid' in entry) || !('last_modified' in entry) || !('name' in entry)) continue;
    const name = String(table[entry.name]), yearRoc = Number(name.match(/^(\d{3})年臺北市河川水質檢測結果$/)?.[1]);
    if (!yearRoc) continue;
    result.push({ year: yearRoc + 1911, yearRoc, resourceId: String(table[entry.rid]), updatedAt: String(table[entry.last_modified]), fileName: String(table[entry.file_name]) });
  }
  if (result.length !== 4 || new Set(result.map(r => r.year)).size !== 4) throw new Error('Expected four independent official annual resources');
  return result.sort((a, b) => a.year - b.year);
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/auditRiverWaterPolicySources.ts')) auditRiverWaterPolicySources().then(m => console.log(`Offline source audit passed: ${m.sources.length} annual editions, ${m.sources.reduce((n, s) => n + s.publishedRowCount, 0)} published rows.`)).catch(e => { console.error(e); process.exitCode = 1; });
