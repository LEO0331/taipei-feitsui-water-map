import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTaipeiWaterSupportTwcSummary } from '../src/utils/twcSupport';
import type { TaipeiWaterSupportTwcMonthlyRecord } from '../src/types/twcSupport';

const publicDir = path.join(process.cwd(), 'public/data');
const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(publicDir, file), 'utf8')) as T;

async function main() {
  const records = await readJson<TaipeiWaterSupportTwcMonthlyRecord[]>('taipei-water-support-twc-monthly-records.json');
  const summary = buildTaipeiWaterSupportTwcSummary(records);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json');
  const conversionReport = await readJson<Record<string, unknown>>('conversion-report.json');
  const supportConversion = await readJson<unknown>('taipei-water-support-twc-conversion-report.json');

  await writeFile(path.join(publicDir, 'taipei-water-support-twc-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'taipei-water-support-twc-annual-summary.json'), `${JSON.stringify(summary.byYear, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, taipeiWaterSupportTwcMonthlyStatistics: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...conversionReport, taipeiWaterSupportTwcMonthlyStatistics: supportConversion }, null, 2)}\n`);
  console.log(`Built Taipei Water support-to-TWC summary for ${summary.totalRecords} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
