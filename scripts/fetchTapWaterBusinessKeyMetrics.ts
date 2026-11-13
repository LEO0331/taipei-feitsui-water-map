import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseRocYearMonth } from '../src/utils/tapWaterBusiness';
import { downloadValidatedCsv, findCsvResource, replaceFile } from './manualCsvRefresh';

const pageUrl = 'https://data.taipei/dataset/detail?id=4487aa01-acc6-4c54-8bef-8d4d2dd6f1b2';
const resourceName = '臺北自來水事業處業務關鍵數據';

export async function fetchTapWaterBusinessKeyMetrics(root = process.cwd(), force = process.argv.includes('--force')) {
  const rawDir = path.join(root, 'data/raw/tap-water-business-key-metrics');
  await mkdir(rawDir, { recursive: true });
  const existing = (await readdir(rawDir).catch(() => [])).filter((file) => file.endsWith('.csv'));
  const writeLocalMetadata = async (note: string) => replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: existing.map((file) => ({ file, resourceName, note })) }, null, 2)}\n`);
  if (existing.length && !force) {
    await writeLocalMetadata('Existing local CSV reused; pass --force to refresh.');
    console.log(`Reused ${existing.length} local business KPI CSV file(s).`);
    return;
  }
  const match = await findCsvResource(pageUrl);
  if (!match) {
    if (existing.length) {
      await writeLocalMetadata('Official resource URL was not found on the Taipei Open Data page; existing local CSV reused.');
      console.warn('No official CSV resource URL found; reused local business KPI CSV file(s).');
      return;
    }
    throw new Error('No CSV resource URL found on Taipei Open Data page and no local CSV fallback exists.');
  }
  const buffer = await downloadValidatedCsv(match, {
    columns: ['年月', '配水量（立方公尺）', '計費水量（立方公尺）', '本月收入（千元）', '本月支出（千元）'],
    hasUsableRow: (row) => Boolean(parseRocYearMonth(row['年月']).monthKey),
  });
  const fileName = '臺北自來水事業處業務關鍵數據.csv';
  await replaceFile(path.join(rawDir, fileName), buffer);
  await replaceFile(path.join(rawDir, 'source-metadata.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), pageUrl, files: [{ file: fileName, resourceName, sourceUrl: match, fileSizeBytes: buffer.byteLength }] }, null, 2)}\n`);
  console.log(`Fetched business KPI CSV: ${fileName}`);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('/fetchTapWaterBusinessKeyMetrics.ts')) fetchTapWaterBusinessKeyMetrics().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
