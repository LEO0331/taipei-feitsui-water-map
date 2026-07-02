import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/carlson-trophic-state-index');
const pageUrl = 'https://data.taipei/dataset/detail?id=56adb2f7-3a86-4a2b-9b4a-610e6df247e5';
const resourceName = '臺北翡翠水庫卡爾森優養指數';

async function main() {
  await mkdir(rawDir, { recursive: true });
  const force = process.argv.includes('--force');
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    pageUrl,
    officialDataset: resourceName,
    officialResourceUpdatedAt: '2026-03-11',
    files: existing.map((file) => ({ file, resourceName, note })),
  }, null, 2)}\n`);
  if (existing.length && !force) {
    await writeLocalMetadata('Existing local CSV reused; pass --force to refresh.');
    console.log(`Reused ${existing.length} local Carlson trophic state index CSV file(s).`);
    return;
  }
  const page = await fetch(pageUrl).then((response) => response.text()).catch((error: unknown) => {
    throw new Error(`Taipei Open Data page fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  const match = page.match(/https:\/\/data\.taipei\/api\/v1\/dataset\/[^"' ]+\?scope=resourceAquire/g)?.[0];
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local Carlson trophic state index CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const arrayBuffer: ArrayBuffer = await fetch(match).then((response) => response.arrayBuffer());
  const fileName = '臺北翡翠水庫卡爾森優養指數.csv';
  await writeFile(path.join(rawDir, fileName), Buffer.from(arrayBuffer));
  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    pageUrl,
    officialDataset: resourceName,
    officialResourceUpdatedAt: '2026-03-11',
    files: [{ file: fileName, resourceName, sourceUrl: match, fileSizeBytes: arrayBuffer.byteLength }],
  }, null, 2)}\n`);
  console.log(`Fetched Carlson trophic state index CSV: ${fileName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
