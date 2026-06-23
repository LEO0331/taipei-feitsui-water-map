import {
  riverIndicatorKeys,
  type RiverAggregate,
  type RiverIndicatorKey,
  type RiverWaterQualityRecord,
  type RiverWaterQualitySummary,
  type RiverWaterQualityValue,
  type WaterValueQualifier,
} from '../types/riverWaterQuality';

export const riverColumnMap: Record<RiverIndicatorKey, { column: string; unit?: string }> = {
  waterTemperatureC: { column: '水溫數值（℃）', unit: '℃' },
  airTemperatureC: { column: '氣溫數值（℃）', unit: '℃' },
  ph: { column: 'pH數值' },
  dissolvedOxygenMgL: { column: '溶氧量數值（mg/l）', unit: 'mg/L' },
  biochemicalOxygenDemandMgL: { column: '生化需氧量數值（mg/l）', unit: 'mg/L' },
  ammoniaNitrogenMgL: { column: '氨氮數值（mg/l）', unit: 'mg/L' },
  nitrateNitrogenMgL: { column: '硝酸鹽氮數值（mg/l）', unit: 'mg/L' },
  nitriteNitrogenMgL: { column: '亞硝酸鹽氮數值（mg/l）', unit: 'mg/L' },
  suspendedSolidsMgL: { column: '懸浮固體數值（mg/l）', unit: 'mg/L' },
  chemicalOxygenDemandMgL: { column: '化學需氧量數值（mg/l）', unit: 'mg/L' },
  cadmiumUgL: { column: '鎘數值（ug/l）', unit: 'μg/L' },
  chromiumUgL: { column: '鉻數值（ug/l）', unit: 'μg/L' },
  copperUgL: { column: '銅數值（ug/l）', unit: 'μg/L' },
  leadUgL: { column: '鉛數值（ug/l）', unit: 'μg/L' },
  zincUgL: { column: '鋅數值（ug/l）', unit: 'μg/L' },
  ironUgL: { column: '鐵數值（ug/l）', unit: 'μg/L' },
  manganeseUgL: { column: '錳數值（ug/l）', unit: 'μg/L' },
  silverUgL: { column: '銀數值（ug/l）', unit: 'μg/L' },
  nickelUgL: { column: '鎳數值（ug/l）', unit: 'μg/L' },
  mercuryUgL: { column: '汞數值（ug/l）', unit: 'μg/L' },
  arsenicUgL: { column: '砷數值（ug/l）', unit: 'μg/L' },
  conductivityUmhoCm: { column: '導電度數值（umho/cm）', unit: 'μmho/cm' },
  totalPhosphorusMgL: { column: '總磷數值（mg/l）', unit: 'mg/L' },
  turbidityNtu: { column: '濁度數值（NTU）', unit: 'NTU' },
  coliformCfuPer100Ml: { column: '大腸桿菌群數值（CFU/100 ml）', unit: 'CFU/100mL' },
  chlorideMgL: { column: '氯鹽數值（mg/l）', unit: 'mg/L' },
  totalNitrogenMgL: { column: '總氮數值（mg/l）', unit: 'mg/L' },
};

export function parseRiverWaterQualityValue(raw: unknown, unit?: string): RiverWaterQualityValue {
  const text = raw === null || raw === undefined ? '' : String(raw).trim();
  if (!text || text.toLowerCase() === 'nan') return { raw: text || undefined, qualifier: 'missing', unit };
  if (text === '---') return { raw: text, qualifier: 'not_measured', unit };
  const nd = text.match(/^(?:ND\s*)?<\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i);
  if (nd) return { raw: text, qualifier: 'not_detected_below', detectionLimit: Number(nd[1]), unit };
  const value = Number(text.replaceAll(',', ''));
  if (Number.isFinite(value)) return { raw: text, value, qualifier: 'measured', unit };
  return { raw: text, qualifier: 'unparsed', unit };
}

export function inferRocYearFromFileName(fileName: string): number | undefined {
  const match = fileName.match(/^(\d{2,3})河川水質/);
  return match ? Number(match[1]) : undefined;
}

export function averageMeasured(records: RiverWaterQualityRecord[], key: RiverIndicatorKey): number | undefined {
  const values = records
    .map((record) => record[key])
    .filter((value) => value.qualifier === 'measured' && value.value !== undefined)
    .map((value) => value.value!);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
}

function aggregate(records: RiverWaterQualityRecord[]): RiverAggregate {
  return {
    recordCount: records.length,
    averageDissolvedOxygenMgL: averageMeasured(records, 'dissolvedOxygenMgL'),
    averageBiochemicalOxygenDemandMgL: averageMeasured(records, 'biochemicalOxygenDemandMgL'),
    averageAmmoniaNitrogenMgL: averageMeasured(records, 'ammoniaNitrogenMgL'),
    averageSuspendedSolidsMgL: averageMeasured(records, 'suspendedSolidsMgL'),
    averageChemicalOxygenDemandMgL: averageMeasured(records, 'chemicalOxygenDemandMgL'),
    averageTurbidityNtu: averageMeasured(records, 'turbidityNtu'),
    averageColiformCfuPer100Ml: averageMeasured(records, 'coliformCfuPer100Ml'),
  };
}

export function buildRiverWaterQualitySummary(records: RiverWaterQualityRecord[]): RiverWaterQualitySummary {
  const byRiver = new Map<string, RiverWaterQualityRecord[]>();
  const byStation = new Map<string, RiverWaterQualityRecord[]>();
  const byMonth = new Map<string, RiverWaterQualityRecord[]>();
  const counts: Record<WaterValueQualifier, number> = {
    measured: 0,
    not_detected_below: 0,
    not_measured: 0,
    missing: 0,
    unparsed: 0,
  };

  for (const record of records) {
    if (!byRiver.has(record.riverName)) byRiver.set(record.riverName, []);
    byRiver.get(record.riverName)!.push(record);
    const stationKey = `${record.riverName}\u0000${record.stationName}`;
    if (!byStation.has(stationKey)) byStation.set(stationKey, []);
    byStation.get(stationKey)!.push(record);
    const period = `${record.year ?? 'unknown'}-${String(record.month).padStart(2, '0')}`;
    if (!byMonth.has(period)) byMonth.set(period, []);
    byMonth.get(period)!.push(record);
    for (const key of riverIndicatorKeys) counts[record[key].qualifier] += 1;
  }

  const years = [...new Set(records.flatMap((record) => record.year ? [record.year] : []))].sort();
  const rocYears = [...new Set(records.flatMap((record) => record.yearRoc ? [record.yearRoc] : []))].sort();
  return {
    totalRecords: records.length,
    years,
    year: years.length === 1 ? years[0] : undefined,
    yearRoc: rocYears.length === 1 ? rocYears[0] : undefined,
    monthCount: new Set(records.map((record) => `${record.year}-${record.month}`)).size,
    riverCount: byRiver.size,
    stationCount: byStation.size,
    byRiver: [...byRiver.entries()].map(([riverName, items]) => ({
      riverName,
      stationCount: new Set(items.map((record) => record.stationName)).size,
      ...aggregate(items),
    })),
    byStation: [...byStation.entries()].map(([key, items]) => {
      const [riverName, stationName] = key.split('\u0000');
      return { riverName, stationName, ...aggregate(items) };
    }),
    byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, items]) => ({
      period,
      year: items[0].year,
      month: items[0].month,
      ...aggregate(items),
    })),
    valueQuality: {
      measuredValueCount: counts.measured,
      notDetectedValueCount: counts.not_detected_below,
      notMeasuredValueCount: counts.not_measured,
      missingValueCount: counts.missing,
      unparsedValueCount: counts.unparsed,
    },
  };
}
