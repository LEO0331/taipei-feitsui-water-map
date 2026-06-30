import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildParkWaterSafetyEquipmentSummary } from '../src/utils/parkWaterSafety';
import type { ParkWaterSafetyEquipmentRecord } from '../src/types/parkWaterSafety';

const publicDir = path.join(process.cwd(), 'public/data');
const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(publicDir, file), 'utf8')) as T;

async function main() {
  const records = await readJson<ParkWaterSafetyEquipmentRecord[]>('park-water-safety-equipment-records.json');
  const summary = buildParkWaterSafetyEquipmentSummary(records);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json');
  const conversionReport = await readJson<Record<string, unknown>>('conversion-report.json');
  const conversion = await readJson<unknown>('park-water-safety-equipment-conversion-report.json');
  await writeFile(path.join(publicDir, 'park-water-safety-equipment-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, parkWaterSafetyEquipment: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...conversionReport, parkWaterSafetyEquipment: conversion }, null, 2)}\n`);
  console.log(`Built park water-safety summary for ${summary.totalRecords} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
