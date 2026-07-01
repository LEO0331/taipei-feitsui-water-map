import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildTapWaterBusinessKeyMetricSummary } from '../src/utils/tapWaterBusiness';
import type { TapWaterBusinessKeyMetricRecord } from '../src/types/tapWaterBusiness';

const publicDir = path.join(process.cwd(), 'public/data');

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(publicDir, file), 'utf8')) as T; } catch { return fallback; }
}

async function main() {
  const records = await readJson<TapWaterBusinessKeyMetricRecord[]>('tap-water-business-key-metrics.json', []);
  const conversion = await readJson<{ dataQuality?: TapWaterBusinessKeyMetricRecord[] } & Record<string, unknown>>('tap-water-business-key-metric-conversion-report.json', {});
  const summary = buildTapWaterBusinessKeyMetricSummary(records);
  await writeFile(path.join(publicDir, 'tap-water-business-key-metric-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json', {});
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, tapWaterBusinessKeyMetrics: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  const report = await readJson<Record<string, unknown>>('conversion-report.json', {});
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...report, tapWaterBusinessKeyMetrics: conversion }, null, 2)}\n`);
  console.log(`Built Taipei Water business key metric summary for ${records.length} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
