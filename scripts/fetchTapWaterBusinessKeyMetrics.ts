import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/tap-water-business-key-metrics');
const pageUrl = 'https://data.taipei/dataset/detail?id=4487aa01-acc6-4c54-8bef-8d4d2dd6f1b2';
const resourceName = '臺北自來水事業處業務關鍵數據';

async function main() {
  await mkdir(rawDir, { recursive: true });
  const force = process.argv.includes('--force');
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: existing.map((file) => ({ file, resourceName, note })) }, null, 2)}\n`);
  if (existing.length && !force) {
    await writeLocalMetadata('Existing local CSV reused; pass --force to refresh.');
    console.log(`Reused ${existing.length} local business KPI CSV file(s).`);
    return;
  }
  const page = await fetch(pageUrl).then((response) => response.text()).catch((error: unknown) => {
    throw new Error(`Taipei Open Data page fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  const match = page.match(/https:\/\/data\.taipei\/api\/v1\/dataset\/[^"' ]+\?scope=resourceAquire/g)?.[0];
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local business KPI CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const arrayBuffer: ArrayBuffer = await fetch(match).then((response) => response.arrayBuffer());
  const fileName = '臺北自來水事業處業務關鍵數據.csv';
  await writeFile(path.join(rawDir, fileName), Buffer.from(arrayBuffer));
  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: [{ file: fileName, resourceName, sourceUrl: match, fileSizeBytes: arrayBuffer.byteLength }] }, null, 2)}\n`);
  console.log(`Fetched business KPI CSV: ${fileName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
