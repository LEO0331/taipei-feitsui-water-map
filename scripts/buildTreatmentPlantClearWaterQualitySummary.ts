import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTreatmentPlantClearWaterQualitySummary } from '../src/utils/clearWaterQuality';
import type { TreatmentPlantClearWaterQualityRecord } from '../src/types/clearWaterQuality';

const publicDir = path.join(process.cwd(), 'public/data');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(publicDir, file), 'utf8')) as T; } catch { return fallback; }
}

async function main() {
  const records = await readJson<TreatmentPlantClearWaterQualityRecord[]>('tap-water-treatment-plant-clear-water-quality-records.json', []);
  const summary = buildTreatmentPlantClearWaterQualitySummary(records);
  await writeFile(path.join(publicDir, 'tap-water-treatment-plant-clear-water-quality-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json', {});
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, treatmentPlantClearWaterQuality: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  const conversionReport = await readJson<Record<string, unknown>>('conversion-report.json', {});
  const conversion = await readJson<Record<string, unknown>>('tap-water-treatment-plant-clear-water-quality-conversion-report.json', {});
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...conversionReport, treatmentPlantClearWaterQuality: conversion }, null, 2)}\n`);
  console.log(`Built treatment plant clear-water quality summary for ${records.length} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
