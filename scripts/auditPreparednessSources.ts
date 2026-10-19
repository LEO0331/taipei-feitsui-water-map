import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parsePreparednessKml } from '../src/utils/preparednessSpatial';

const rawDirectory = path.join(process.cwd(), 'data/raw/preparedness-decision');
export const preparednessResources = [
  { sourceId: 'pumping', datasetId: '026cc0fa-cecc-4c78-b986-ead3b0c8b95b', resourceId: 'd1f9c6e0-5f72-4fc4-ac18-0b75ce0b002e', publicationDate: '2026-06-25', localPath: 'data/raw/pumping-stations/臺北市水利處抽水站TWD97.csv', version: 'catalogue-2026-06-25' },
  { sourceId: 'machinery', datasetId: 'cdbc2677-7f23-42e5-9b83-a57ab9bee39c', resourceId: '0f4541e5-9f7c-406f-bbd4-3c22e6255465', publicationDate: '2026-07-21', localPath: 'data/raw/storm-rainfall-rented-machinery-sites/official-1.csv', version: '115年度/2026' },
  { sourceId: 'basin', datasetId: '03db6e0d-c6a6-400a-9e52-9b821c404c38', resourceId: 'a513c535-e903-4b69-9f5e-7ba6d7b6aa3d', publicationDate: '2024-12-18', localPath: 'data/raw/sedimentation-basin-facilities/沉砂池OK.csv', version: 'catalogue-2024-12-18' },
  { sourceId: 'flood-prone', datasetId: '08101966-7aca-48e0-a028-6da02ba1192e', resourceId: 'db12426f-777c-48f0-90a8-bb582f39a33e', publicationDate: '2025-06-03', version: 'catalogue-2025-06-03' },
  { sourceId: 'historical-inundation', datasetId: '8377b584-81e9-432d-b902-5b4e9978e6bc', resourceId: 'dbed5503-d5fb-46d5-8701-7b591ac38c35', publicationDate: '2026-09-30', version: 'catalogue-2026-09-30/document-1140307' },
];
export const preparednessHash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
/** Explicitly invoked acquisition only. The ordinary converter is fully offline. */
async function main() {
  await mkdir(rawDirectory, { recursive: true });
  const retrievedAt = new Date().toISOString(), entries = [];
  for (const resource of preparednessResources) {
    const sourceUrl = `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=${resource.resourceId}`;
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${resource.sourceId}: HTTP ${response.status}; previous manifest retained`);
    const bytes = Buffer.from(await response.arrayBuffer()), sourceSha256 = preparednessHash(bytes);
    let localPath: string;
    if ('localPath' in resource && resource.localPath) {
      localPath = resource.localPath;
      // Verify the local edition's identity, never rewrite existing module source data or duplicate contact fields.
      const existing = await readFile(path.join(process.cwd(), localPath));
      if (preparednessHash(existing) !== sourceSha256) throw new Error(`${resource.sourceId}: local bytes differ from selected official edition; previous manifest retained`);
    } else {
      const parsed = parsePreparednessKml(bytes.toString('utf8'));
      if (!parsed.some((feature) => feature.geometry)) throw new Error(`${resource.sourceId}: no usable official polygon; previous manifest retained`);
      localPath = `data/raw/preparedness-decision/${resource.sourceId}-${sourceSha256}.kml`;
      await writeFile(path.join(process.cwd(), localPath), bytes);
    }
    entries.push({ ...resource, sourceUrl, localPath, sourceSha256, byteLength: bytes.length, retrievedAt, publisher: '臺北市政府工務局水利工程處', coordinateSystem: resource.sourceId === 'pumping' || resource.sourceId === 'basin' ? 'EPSG:3826' : 'EPSG:4326', geometryPrecision: 'official_source_precision_not_survey_certified' });
    console.log(`Verified ${resource.sourceId}: ${bytes.length} bytes SHA256 ${sourceSha256}`);
  }
  const manifest = { schemaVersion: '1.0.0', auditedAt: retrievedAt, sources: entries };
  const temporary = path.join(rawDirectory, 'source-manifest.json.tmp');
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(temporary, path.join(rawDirectory, 'source-manifest.json'));
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/auditPreparednessSources.ts')) main().catch((error) => { console.error(error); process.exitCode = 1; });
