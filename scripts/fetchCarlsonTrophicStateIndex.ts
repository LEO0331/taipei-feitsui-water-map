import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseRocYear } from '../src/utils/carlsonTrophicStateIndex';
import { downloadValidatedCsv, findCsvResource, replaceFile } from './manualCsvRefresh';

const pageUrl = 'https://data.taipei/dataset/detail?id=56adb2f7-3a86-4a2b-9b4a-610e6df247e5';
const resourceName = '臺北翡翠水庫卡爾森優養指數';

export async function fetchCarlsonTrophicStateIndex(root = process.cwd(), force = process.argv.includes('--force')) {
  const rawDir = path.join(root, 'data/raw/carlson-trophic-state-index');
  await mkdir(rawDir, { recursive: true });
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
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
  const match = await findCsvResource(pageUrl);
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local Carlson trophic state index CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const buffer = await downloadValidatedCsv(match, {
    columns: ['民國年', /卡爾森優養指數/, '優養指標'],
    hasUsableRow: (row) => Boolean(parseRocYear(row['民國年']).year),
  });
  const fileName = '臺北翡翠水庫卡爾森優養指數.csv';
  await replaceFile(path.join(rawDir, fileName), buffer);
  await replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    pageUrl,
    officialDataset: resourceName,
    officialResourceUpdatedAt: '2026-03-11',
    files: [{ file: fileName, resourceName, sourceUrl: match, fileSizeBytes: buffer.byteLength }],
  }, null, 2)}\n`);
  console.log(`Fetched Carlson trophic state index CSV: ${fileName}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/fetchCarlsonTrophicStateIndex.ts')) fetchCarlsonTrophicStateIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
