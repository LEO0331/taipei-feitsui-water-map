import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/tap-water-treatment-plant-clear-water-quality');
const pageUrl = 'https://data.taipei/dataset/detail?id=ee8842ea-25a2-4cd2-a6c0-d50b37ab18d0';
const fallbackResourceName = '臺北自來水事業處各淨水場清水水質114/5-115/4';

async function main() {
  await mkdir(rawDir, { recursive: true });
  const force = process.argv.includes('--force');
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => {
    await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: existing.map((file) => ({ file, resourceName: fallbackResourceName, note })) }, null, 2)}\n`);
  };
  if (existing.length && !force) {
    await writeLocalMetadata('Existing local CSV reused; pass --force to refresh.');
    console.log(`Reused ${existing.length} local clear-water CSV file(s).`);
    return;
  }
  const page = await fetch(pageUrl).then((response) => response.text()).catch((error: unknown) => {
    throw new Error(`Taipei Open Data page fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  });
  const match = page.match(/https:\/\/data\.taipei\/api\/v1\/dataset\/[^"' ]+\?scope=resourceAquire/g)?.[0];
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local clear-water CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const fileName = '臺北自來水事業處各淨水場清水水質.csv';
  const arrayBuffer: ArrayBuffer = await fetch(match).then((response) => response.arrayBuffer());
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(path.join(rawDir, fileName), buffer);
  await writeFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: [{ file: fileName, resourceName: fallbackResourceName, sourceUrl: match, fileSizeBytes: buffer.byteLength }] }, null, 2)}\n`);
  await readFile(path.join(rawDir, fileName));
  console.log(`Fetched clear-water quality CSV: ${fileName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
