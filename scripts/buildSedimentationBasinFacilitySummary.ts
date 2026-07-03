import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSedimentationBasinFacilitySummary } from '../src/utils/sedimentationBasins';
import type { SedimentationBasinFacilityRecord } from '../src/types/sedimentationBasins';

const publicDir = path.join(process.cwd(), 'public/data');
const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(publicDir, file), 'utf8')) as T;

async function main() {
  const records = await readJson<SedimentationBasinFacilityRecord[]>('sedimentation-basin-facilities.json');
  const previous = await readJson<{ dataQuality?: Record<string, number> }>('sedimentation-basin-facility-summary.json').catch(() => ({ dataQuality: undefined }));
  const summary = buildSedimentationBasinFacilitySummary(records, previous.dataQuality);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json');
  const conversionReport = await readJson<Record<string, unknown>>('conversion-report.json');
  const conversion = await readJson<unknown>('sedimentation-basin-facility-conversion-report.json');
  await writeFile(path.join(publicDir, 'sedimentation-basin-facility-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, sedimentationBasinFacilities: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...conversionReport, sedimentationBasinFacilities: conversion }, null, 2)}\n`);
  console.log(`Built sedimentation basin summary for ${summary.totalRecords} record(s).`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
