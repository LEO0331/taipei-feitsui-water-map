import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditRiverPolicyStations, auditRiverWaterPolicySources, catalogueResources, inspectRiverPolicyCsv, riverPolicyCatalogueUrl, riverPolicyContextResources, riverPolicyDatasetId, riverPolicyHash, type RiverPolicyManifest } from './auditRiverWaterPolicySources';

export async function acceptRiverPolicyStage(root: string, sha256: string) {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Acceptance requires an exact staged SHA-256');
  const directory = path.join(root, 'data/raw/river-water-policy');
  const bytes = await readFile(path.join(directory, `staged-${sha256}.json`));
  if (riverPolicyHash(bytes) !== sha256) throw new Error('Staged manifest hash mismatch; acceptance refused');
  const manifest: RiverPolicyManifest = JSON.parse(bytes.toString('utf8'));
  await auditRiverWaterPolicySources(root, manifest);
  await writeFile(path.join(directory, `manifest-${sha256}.json`), bytes, { flag: 'wx' }).catch(async e => {
    if (e.code !== 'EEXIST' || riverPolicyHash(await readFile(path.join(directory, `manifest-${sha256}.json`))) !== sha256) throw e;
  });
  const temporary = path.join(directory, 'source-manifest.json.tmp');
  await writeFile(temporary, bytes);
  await rename(temporary, path.join(directory, 'source-manifest.json'));
  return manifest;
}

export async function fetchRiverWaterPolicySources(args = process.argv.slice(2), root = process.cwd()) {
  const acceptArgument = args.find(a => a.startsWith('--accept='));
  if (acceptArgument) {
    if (args.includes('--refresh')) throw new Error('Accept a reviewed staged hash offline; omit --refresh');
    const hash = acceptArgument.slice('--accept='.length);
    await acceptRiverPolicyStage(root, hash);
    console.log(`Accepted exact reviewed staged manifest ${hash} without network I/O.`);
    return;
  }
  if (!args.includes('--refresh')) {
    if (args.includes('--accept')) throw new Error('--accept requires an explicit --refresh or --accept=<staged-sha256>');
    await auditRiverWaterPolicySources(root);
    console.log('Offline audit only. Network refresh requires --refresh; acceptance also requires --accept.');
    return;
  }
  const directory = path.join(root, 'data/raw/river-water-policy');
  await mkdir(directory, { recursive: true });
  const retrievedAt = new Date().toISOString(), analysisDate = '2026-10-27';
  const retain = async (sourceId: string, sourceUrl: string, extension: string) => {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`${sourceId}: HTTP ${response.status}; accepted sources untouched`);
    const bytes = Buffer.from(await response.arrayBuffer()), sha256 = riverPolicyHash(bytes);
    const localPath = `data/raw/river-water-policy/${sourceId}-${sha256}.${extension}`;
    await writeFile(path.join(root, localPath), bytes, { flag: 'wx' }).catch(async e => { if (e.code !== 'EEXIST' || riverPolicyHash(await readFile(path.join(root, localPath))) !== sha256) throw e; });
    return { sourceId, sourceUrl, localPath, sha256, byteLength: bytes.length, retrievedAt, bytes };
  };
  const context = [];
  for (const resource of riverPolicyContextResources) context.push(await retain(resource.sourceId, resource.sourceUrl, 'html'));
  const resources = catalogueResources(context[0].bytes.toString('utf8'));
  const sources: RiverPolicyManifest['sources'] = [], annual = [];
  const stationHtml = context[1].bytes.toString('utf8');
  for (const resource of resources) {
    const downloadUrl = `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${resource.resourceId}`;
    const retained = await retain(`river-${resource.year}`, downloadUrl, 'csv');
    const audit = inspectRiverPolicyCsv(retained.bytes, resource.year, analysisDate);
    const historicalPath = `data/raw/river-water-quality/${resource.fileName}`;
    const historical = await readFile(path.join(root, historicalPath));
    const { rows, ...stats } = audit;
    sources.push({ sourceId: retained.sourceId, datasetId: riverPolicyDatasetId, resourceId: resource.resourceId, catalogueUrl: riverPolicyCatalogueUrl, downloadUrl, publisher: '臺北市政府環境保護局', yearRoc: resource.yearRoc, year: resource.year, updatedAt: resource.updatedAt, retrievedAt, localPath: retained.localPath, sha256: retained.sha256, byteLength: retained.byteLength, ...stats, admissionStatus: 'accepted', historicalComparison: { localPath: historicalPath, sha256: riverPolicyHash(historical), byteLength: historical.length, identical: riverPolicyHash(historical) === retained.sha256 } });
    annual.push({ year: resource.year, rows });
  }
  const manifest: RiverPolicyManifest = { schemaVersion: '1.0.0', analysisDate, acceptedAt: retrievedAt, sources, context: context.map(({ bytes: _bytes, ...entry }) => entry), stationAudit: auditRiverPolicyStations(annual, stationHtml) };
  await auditRiverWaterPolicySources(root, manifest);
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`, manifestSha = riverPolicyHash(manifestBytes);
  const stagedPath = path.join(directory, `staged-${manifestSha}.json`);
  await writeFile(stagedPath, manifestBytes, { flag: 'wx' }).catch(async e => {
    if (e.code !== 'EEXIST' || riverPolicyHash(await readFile(stagedPath)) !== manifestSha) throw e;
  });
  console.log(`Validated staged edition: ${stagedPath}`);
  if (!args.includes('--accept')) { console.log(`Accepted manifest unchanged. Inspect staged files, then run --accept=${manifestSha} to accept these exact validated bytes offline.`); return; }
  await acceptRiverPolicyStage(root, manifestSha);
  console.log(`Accepted ${sources.length} annual editions after original-byte/schema/identity validation. Manifest SHA256 ${manifestSha}`);
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/fetchRiverWaterPolicySources.ts')) fetchRiverWaterPolicySources().catch(error => { console.error(error); process.exitCode = 1; });
