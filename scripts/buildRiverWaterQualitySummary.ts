import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildRiverWaterQualitySummary } from '../src/utils/riverWaterQuality';
import type { RiverWaterQualityRecord } from '../src/types/riverWaterQuality';

const publicDataDir = path.join(process.cwd(), 'public/data');

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(publicDataDir, file), 'utf8')) as T;
}

async function main() {
  const records = await readJson<RiverWaterQualityRecord[]>('river-water-quality-records.json');
  const riverSummary = buildRiverWaterQualitySummary(records);
  const feitsuiSummary = await readJson<unknown>('water-quality-summary.json');
  const conversionReport = await readJson<Record<string, unknown>>('conversion-report.json');
  const riverConversion = await readJson<unknown>('river-water-quality-conversion-report.json');
  const pumpingSummary = await readJson<unknown>('pumping-station-summary.json');
  const pumpingConversion = await readJson<unknown>('pumping-station-conversion-report.json');

  await writeFile(path.join(publicDataDir, 'river-water-quality-summary.json'), `${JSON.stringify(riverSummary, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'water-dashboard-summary.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    feitsuiReservoir: feitsuiSummary,
    riverWaterQuality: riverSummary,
    pumpingStations: pumpingSummary,
  }, null, 2)}\n`);
  await writeFile(path.join(publicDataDir, 'conversion-report.json'), `${JSON.stringify({
    ...conversionReport,
    riverWaterQuality: riverConversion,
    pumpingStations: pumpingConversion,
  }, null, 2)}\n`);
  console.log(`Built river summary for ${riverSummary.totalRecords} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
