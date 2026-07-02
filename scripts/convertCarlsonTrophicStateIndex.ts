import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addCtsiTrendFields, buildCarlsonTrophicStateIndexSummary, classifyCarlsonTrophicStateIndex, cleanText, parseCarlsonTrophicStateIndex, parseRocYear, parseTrophicStateIndicator } from '../src/utils/carlsonTrophicStateIndex';
import type { CarlsonTrophicStateIndexRecord } from '../src/types/carlsonTrophicStateIndex';

const rawDir = path.join(process.cwd(), 'data/raw/carlson-trophic-state-index');
const publicDir = path.join(process.cwd(), 'public/data');
const source = '臺北翡翠水庫卡爾森優養指數';
const sourceAgency = '翡管局';

function decode(buffer: Buffer) {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (utf8.includes('民國年') && utf8.includes('優養指標')) return utf8;
  return new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
}

function csv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') i += 1; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); }
  return rows;
}

const hash = (value: string) => createHash('sha1').update(value).digest('hex').slice(0, 16);
const find = (row: Record<string, string | undefined>, predicate: (header: string) => boolean) => row[Object.keys(row).find(predicate) ?? ''];

async function main() {
  await mkdir(publicDir, { recursive: true });
  let metadata: { files?: Array<{ file: string; resourceName?: string }> } = {};
  try { metadata = JSON.parse(await readFile(path.join(rawDir, 'source-metadata.json'), 'utf8')); } catch { /* local fallback */ }
  const discovered = (await readdir(rawDir)).filter((file) => file.endsWith('.csv')).map((file) => ({ file, resourceName: source }));
  const sourceFiles = metadata.files?.filter((file) => file.file.endsWith('.csv')) ?? discovered;
  const warnings: Array<{ file: string; row?: number; issue: string; value?: string }> = [];
  const duplicateYears: number[] = [];
  const seenYears = new Set<number>();
  let invalidYearCount = 0;
  let missingCtsiCount = 0;
  let invalidCtsiCount = 0;
  let unknownIndicatorCount = 0;
  const records: CarlsonTrophicStateIndexRecord[] = [];

  for (const sourceFile of sourceFiles) {
    const rows = csv(decode(await readFile(path.join(rawDir, sourceFile.file))));
    const [header = [], ...body] = rows;
    const headers = header.map((value) => value.trim());
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(headers.map((name, column) => [name, cleanText(values[column])]));
      const period = parseRocYear(row['民國年']);
      if (!period.rocYear || !period.year) {
        invalidYearCount += 1;
        warnings.push({ file: sourceFile.file, row: index + 2, issue: period.warning ?? 'Invalid ROC year', value: period.raw });
        continue;
      }
      if (seenYears.has(period.year)) duplicateYears.push(period.year); else seenYears.add(period.year);
      const ctsi = parseCarlsonTrophicStateIndex(find(row, (headerName) => headerName.includes('卡爾森優養指數')));
      if (!ctsi.value && ctsi.value !== 0) missingCtsiCount += 1;
      if (ctsi.warning && ctsi.value !== undefined) invalidCtsiCount += 1;
      if (ctsi.warning) warnings.push({ file: sourceFile.file, row: index + 2, issue: ctsi.warning, value: ctsi.raw });
      const indicator = parseTrophicStateIndicator(row['優養指標']);
      if (indicator.category === 'unknown') unknownIndicatorCount += 1;
      if (indicator.warning) warnings.push({ file: sourceFile.file, row: index + 2, issue: indicator.warning, value: indicator.raw });
      records.push({
        id: `${period.year}`,
        module: 'carlson_trophic_state_index',
        sourceId: row['_id'],
        agencyName: row['機關名稱'],
        agencyCode: row['機關代碼'],
        rocYear: period.rocYear,
        year: period.year,
        yearKey: `${period.year}`,
        periodDate: `${period.year}-01-01`,
        ctsiRaw: ctsi.raw,
        ctsi: ctsi.value,
        ctsiCategory: classifyCarlsonTrophicStateIndex(ctsi.value),
        trophicStateIndicatorRaw: indicator.raw,
        trophicStateIndicatorCategory: indicator.category,
        trendDirection: 'unknown',
        isLatestYear: false,
        sourceRecordHash: hash([sourceFile.resourceName ?? source, period.year, ctsi.raw, indicator.raw].join('|')),
        source,
        sourceAgency,
      });
    }
  }

  const sorted = addCtsiTrendFields(records).sort((a, b) => a.year - b.year);
  const latestYear = sorted.at(-1)?.year;
  const finalRecords = sorted.map((record) => ({ ...record, isLatestYear: record.year === latestYear }));
  const summary = buildCarlsonTrophicStateIndexSummary(finalRecords, {
    invalidYearCount,
    missingCtsiCount,
    invalidCtsiCount,
    duplicateYearCount: new Set(duplicateYears).size,
    unknownIndicatorCount,
  });
  const latest = finalRecords.filter((record) => record.isLatestYear);
  await writeFile(path.join(publicDir, 'carlson-trophic-state-index.json'), `${JSON.stringify(finalRecords, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'carlson-trophic-state-index-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'carlson-trophic-state-index-latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'carlson-trophic-state-index-conversion-report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    officialDataset: source,
    sourceAgency,
    officialResourceUpdatedAt: '2026-03-11',
    sources: sourceFiles,
    recordCount: finalRecords.length,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 100),
    duplicateYears: [...new Set(duplicateYears)],
    notes: ['Annual CTSI rows have no coordinates, addresses, stations, or facility point fields; no geocoding or map markers are produced.', 'CTSI summaries are source-field calculations for annual trophic-state context, not real-time water quality, drinking-water safety, pollution-source determination, or official risk scoring.'],
  }, null, 2)}\n`);
  console.log(`Converted ${finalRecords.length} Carlson trophic state index record(s) from ${sourceFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
