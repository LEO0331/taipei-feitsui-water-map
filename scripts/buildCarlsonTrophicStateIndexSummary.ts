import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCarlsonTrophicStateIndexSummary } from '../src/utils/carlsonTrophicStateIndex';
import type { CarlsonTrophicStateIndexRecord, CarlsonTrophicStateIndexSummary } from '../src/types/carlsonTrophicStateIndex';

const publicDir = path.join(process.cwd(), 'public/data');

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(publicDir, fileName), 'utf8')) as T; } catch { return fallback; }
}

async function main() {
  const records = await readJson<CarlsonTrophicStateIndexRecord[]>('carlson-trophic-state-index.json', []);
  const conversion = await readJson<Record<string, unknown>>('carlson-trophic-state-index-conversion-report.json', {});
  const previous = await readJson<Partial<CarlsonTrophicStateIndexSummary>>('carlson-trophic-state-index-summary.json', {});
  const summary = buildCarlsonTrophicStateIndexSummary(records, previous.dataQuality);
  await writeFile(path.join(publicDir, 'carlson-trophic-state-index-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  const dashboard = await readJson<Record<string, unknown>>('water-dashboard-summary.json', {});
  await writeFile(path.join(publicDir, 'water-dashboard-summary.json'), `${JSON.stringify({ ...dashboard, carlsonTrophicStateIndex: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  const feitsui = await readJson<Record<string, unknown>>('feitsui-water-summary.json', {});
  await writeFile(path.join(publicDir, 'feitsui-water-summary.json'), `${JSON.stringify({ ...feitsui, carlsonTrophicStateIndex: summary, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  const report = await readJson<Record<string, unknown>>('conversion-report.json', {});
  await writeFile(path.join(publicDir, 'conversion-report.json'), `${JSON.stringify({ ...report, carlsonTrophicStateIndex: conversion }, null, 2)}\n`);
  console.log(`Built Carlson trophic state index summary for ${records.length} record(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
