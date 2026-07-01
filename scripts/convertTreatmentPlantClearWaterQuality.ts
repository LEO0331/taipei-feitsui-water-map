import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CLEAR_WATER_QUALITY_SITES, buildTreatmentPlantClearWaterQualitySummary, cleanText, compareMeasuredValueToStandard, deriveDetectionStatus, parseClearWaterQualityPeriod, parseIntegerText, parseNumericValue, parseWaterQualityStandardLimit, parseWaterQualityTestItem } from '../src/utils/clearWaterQuality';
import type { TreatmentPlantClearWaterQualityRecord } from '../src/types/clearWaterQuality';

const rawDir = path.join(process.cwd(), 'data/raw/tap-water-treatment-plant-clear-water-quality');
const publicDir = path.join(process.cwd(), 'public/data');
const source = '臺北自來水事業處各淨水場清水水質';
const sourceAgency = '臺北自來水事業處';
const defaultResourceName = '臺北自來水事業處各淨水場清水水質114/5-115/4';

function decode(buffer: Buffer) {
  const utf8 = buffer.toString('utf8').replace(/^\uFEFF/, '');
  return !utf8.includes('�') && utf8.includes('檢驗項目') ? utf8 : new TextDecoder('big5').decode(buffer).replace(/^\uFEFF/, '');
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

async function main() {
  await mkdir(publicDir, { recursive: true });
  const metadataPath = path.join(rawDir, 'source-metadata.json');
  let metadata: { files?: Array<{ file: string; resourceName?: string; sourceUrl?: string }> } = {};
  try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')); } catch { /* local file fallback */ }
  const discoveredFiles = (await readdir(rawDir)).filter((file) => file.endsWith('.csv')).map((file) => ({ file, resourceName: defaultResourceName }));
  const sourceFiles = metadata.files?.filter((file) => file.file.endsWith('.csv')) ?? discoveredFiles;
  const records: TreatmentPlantClearWaterQualityRecord[] = [];
  const warnings: Array<{ file: string; row?: number; issue: string; value?: string }> = [];
  const duplicatePrimaryKeys: string[] = [];
  const duplicateFallbackKeys: string[] = [];
  const seenPrimary = new Set<string>();
  const seenFallback = new Set<string>();

  for (const sourceFile of sourceFiles) {
    const fileName = sourceFile.file;
    const resourceName = sourceFile.resourceName ?? defaultResourceName;
    const period = parseClearWaterQualityPeriod({ resourceName, fileName });
    if (period.warning) warnings.push({ file: fileName, issue: period.warning });
    const rows = csv(decode(await readFile(path.join(rawDir, fileName))));
    const [header = [], ...body] = rows;
    const headers = header.map((value) => value.trim());
    for (const [index, values] of body.entries()) {
      const row = Object.fromEntries(headers.map((name, column) => [name, values[column]?.trim()]));
      const item = parseWaterQualityTestItem(row['檢驗項目']);
      if (!item.testItem || !item.testItemKey) { warnings.push({ file: fileName, row: index + 2, issue: 'Missing test item' }); continue; }
      const sequence = parseIntegerText(row['項次']);
      const standard = parseWaterQualityStandardLimit(row['水質標準限值']);
      const detection = parseNumericValue(row['方法偵測極限數值']);
      if (standard.warning) warnings.push({ file: fileName, row: index + 2, issue: standard.warning, value: standard.raw });
      if (detection.warning) warnings.push({ file: fileName, row: index + 2, issue: detection.warning, value: detection.raw });
      for (const [siteKey, site] of Object.entries(CLEAR_WATER_QUALITY_SITES)) {
        const measured = parseNumericValue(row[site.sourceColumn]);
        if (measured.warning) warnings.push({ file: fileName, row: index + 2, issue: measured.warning, value: measured.raw });
        const comparison = compareMeasuredValueToStandard({ measuredValue: measured.value, standardLimitType: standard.type, standardLimitLower: standard.lower, standardLimitUpper: standard.upper });
        const detectionStatus = deriveDetectionStatus({ measuredValue: measured.value, methodDetectionLimit: detection.value });
        const primaryKey = `${period.sourcePeriodMonthKey ?? ''}|${item.testItemKey}|${siteKey}`;
        const fallbackKey = `${resourceName}|${sequence ?? ''}|${item.testItemRaw ?? ''}|${siteKey}`;
        if (seenPrimary.has(primaryKey)) duplicatePrimaryKeys.push(primaryKey); else seenPrimary.add(primaryKey);
        if (seenFallback.has(fallbackKey)) duplicateFallbackKeys.push(fallbackKey); else seenFallback.add(fallbackKey);
        const sourceRecordHash = hash(fallbackKey);
        records.push({
          id: `${period.sourcePeriodMonthKey ?? 'unknown'}-${item.testItemKey}-${siteKey}`,
          module: 'tap_water_treatment_plant_clear_water_quality',
          resourceName,
          sourceFileName: fileName,
          ...period,
          sourceSequenceNumber: sequence,
          testItemRaw: item.testItemRaw ?? item.testItem,
          testItem: item.testItem,
          testItemNormalized: item.testItemNormalized,
          testItemKey: item.testItemKey,
          testItemCategory: item.testItemCategory,
          unit: cleanText(row['單位']),
          unitNormalized: cleanText(row['單位']),
          standardLimitRaw: standard.raw,
          standardLimitType: standard.type,
          standardLimitLower: standard.lower,
          standardLimitUpper: standard.upper,
          standardLimitDisplay: standard.display ?? standard.raw,
          hasStandardLimit: standard.type !== 'none',
          methodDetectionLimitRaw: detection.raw,
          methodDetectionLimit: detection.value,
          hasMethodDetectionLimit: detection.value !== undefined,
          siteKey: siteKey as TreatmentPlantClearWaterQualityRecord['siteKey'],
          siteNameZh: site.siteNameZh,
          siteNameEn: site.siteNameEn,
          siteType: site.siteType,
          measuredValueRaw: measured.raw,
          measuredValue: measured.value,
          ...detectionStatus,
          ...comparison,
          sourceRecordHash,
          source,
          sourceAgency,
        });
      }
    }
  }

  const summary = buildTreatmentPlantClearWaterQualitySummary(records);
  const latestMonth = summary.sourcePeriodMonthKey;
  const latest = latestMonth ? records.filter((record) => record.sourcePeriodMonthKey === latestMonth) : records;
  await writeFile(path.join(publicDir, 'tap-water-treatment-plant-clear-water-quality-records.json'), `${JSON.stringify(records, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-treatment-plant-clear-water-quality-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-treatment-plant-clear-water-quality-latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  await writeFile(path.join(publicDir, 'tap-water-treatment-plant-clear-water-quality-conversion-report.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    officialDataset: source,
    sourceAgency: '北水處',
    sources: sourceFiles,
    recordCount: records.length,
    warningCount: warnings.length,
    warnings: warnings.slice(0, 100),
    duplicatePrimaryKeys: [...new Set(duplicatePrimaryKeys)],
    duplicateFallbackKeys: [...new Set(duplicateFallbackKeys)],
    notes: ['CSV has no official coordinates; no geocoding or source-generated map markers are produced.', 'Standard comparisons are source-field comparisons, not safety or enforcement conclusions.'],
  }, null, 2)}\n`);
  console.log(`Converted ${records.length} treatment plant clear-water quality record(s) from ${sourceFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
