import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { CLEAR_WATER_QUALITY_SITES } from '../src/utils/clearWaterQuality';
import { downloadValidatedCsv, findCsvResource, replaceFile } from './manualCsvRefresh';

const pageUrl = 'https://data.taipei/dataset/detail?id=ee8842ea-25a2-4cd2-a6c0-d50b37ab18d0';
const fallbackResourceName = '臺北自來水事業處各淨水場清水水質114/5-115/4';

export async function fetchTreatmentPlantClearWaterQuality(root = process.cwd(), force = process.argv.includes('--force')) {
  const rawDir = path.join(root, 'data/raw/tap-water-treatment-plant-clear-water-quality');
  await mkdir(rawDir, { recursive: true });
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => {
    await replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: existing.map((file) => ({ file, resourceName: fallbackResourceName, note })) }, null, 2)}\n`);
  };
  if (existing.length && !force) {
    await writeLocalMetadata('Existing local CSV reused; pass --force to refresh.');
    console.log(`Reused ${existing.length} local clear-water CSV file(s).`);
    return;
  }
  const match = await findCsvResource(pageUrl);
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local clear-water CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const fileName = '臺北自來水事業處各淨水場清水水質.csv';
  const buffer = await downloadValidatedCsv(match, {
    columns: ['檢驗項目', '單位', '水質標準限值', '方法偵測極限數值', ...Object.values(CLEAR_WATER_QUALITY_SITES).map(site => site.sourceColumn)],
    hasUsableRow: (row) => Boolean(row['檢驗項目']),
  });
  await replaceFile(path.join(rawDir, fileName), buffer);
  await replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: [{ file: fileName, resourceName: fallbackResourceName, sourceUrl: match, fileSizeBytes: buffer.byteLength }] }, null, 2)}\n`);
  console.log(`Fetched clear-water quality CSV: ${fileName}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/fetchTreatmentPlantClearWaterQuality.ts')) fetchTreatmentPlantClearWaterQuality().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
