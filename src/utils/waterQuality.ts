import type {
  Filters,
  StationComparisonPoint,
  StationGroup,
  WaterQualityParameterKey,
  WaterQualityRecord,
  WaterQualitySummary,
  WaterQualityValue,
} from '../types/waterQuality';

export const parameterKeys = [
  'waterLevelM',
  'airTemperatureC',
  'waterDepthM',
  'transparencyM',
  'waterTemperatureC',
  'turbidityNTU',
  'pH',
  'ammoniaNitrogenMgL',
  'dissolvedOxygenMgL',
  'bodMgL',
  'codMgL',
  'suspendedSolidsMgL',
  'conductivityUsCm',
  'manganeseMgL',
  'coliformCfu100mL',
  'totalOrganicCarbonMgL',
  'totalPhosphorusUgL',
  'chlorophyllAUgL',
  'algaeCellsPerML',
] as const satisfies WaterQualityParameterKey[];

export const parameterColumnMap: Record<WaterQualityParameterKey, string[]> = {
  waterLevelM: ['水位m（數值）', '水位m(數值)', '水位m'],
  airTemperatureC: ['氣溫℃（數值）', '氣溫℃(數值)', '氣溫℃'],
  waterDepthM: ['水深m（數值）', '水深m(數值)', '水深m'],
  transparencyM: ['透明度m（數值）', '透明度m(數值)', '透明度m'],
  waterTemperatureC: ['水溫℃（數值）', '水溫℃(數值)', '水溫℃'],
  turbidityNTU: ['濁度NTU', '濁度ntu'],
  pH: ['酸鹼值（數值）', '酸鹼值(數值)', '酸鹼值'],
  ammoniaNitrogenMgL: ['氨氮mg/L', '氨氮mg/l'],
  dissolvedOxygenMgL: ['溶氧量mg/L（數值）', '溶氧量mg/L(數值)', '溶氧量mg/l（數值）', '溶氧量mg/L'],
  bodMgL: ['生化需氧量mg/L', '生化需氧量mg/l'],
  codMgL: ['化學需氧量mg/L', '化學需氧量mg/l'],
  suspendedSolidsMgL: ['懸浮固體量mg/L', '懸浮固體量mg/l'],
  conductivityUsCm: ['導電度μS/cm（數值）', '導電度μS/cm(數值)', '導電度μs/cm（數值）', '導電度μS/cm'],
  manganeseMgL: ['錳mg/L', '錳mg/l'],
  coliformCfu100mL: ['大腸桿菌群CFU/100mL', '大腸桿菌群cfu/100ml'],
  totalOrganicCarbonMgL: ['總有機碳mg/L', '總有機碳mg/l'],
  totalPhosphorusUgL: ['總磷μg/L', '總磷μg/l'],
  chlorophyllAUgL: ['葉綠素aμg/L', '葉綠素aμg/l'],
  algaeCellsPerML: ['藻類數cell/mL', '藻類數cell/ml'],
};

export const stationGroupOrder: StationGroup[] = [
  'dam_profile',
  'reservoir_surface',
  'tributary_or_stream',
  'downstream',
  'summary',
  'unknown',
];

const parameterSearchTerms: Record<WaterQualityParameterKey, string> = {
  waterLevelM: '水位 water level',
  airTemperatureC: '氣溫 air temperature',
  waterDepthM: '水深 water depth',
  transparencyM: '透明度 transparency',
  waterTemperatureC: '水溫 water temperature',
  turbidityNTU: '濁度 turbidity',
  pH: '酸鹼值 ph',
  ammoniaNitrogenMgL: '氨氮 ammonia nitrogen',
  dissolvedOxygenMgL: '溶氧量 dissolved oxygen',
  bodMgL: '生化需氧量 bod',
  codMgL: '化學需氧量 cod',
  suspendedSolidsMgL: '懸浮固體量 suspended solids',
  conductivityUsCm: '導電度 conductivity',
  manganeseMgL: '錳 manganese',
  coliformCfu100mL: '大腸桿菌群 coliform',
  totalOrganicCarbonMgL: '總有機碳 total organic carbon',
  totalPhosphorusUgL: '總磷 total phosphorus',
  chlorophyllAUgL: '葉綠素a chlorophyll-a',
  algaeCellsPerML: '藻類數 algae count',
};

const stationGroupSearchTerms: Record<StationGroup, string> = {
  dam_profile: '大壩剖面 dam profile',
  reservoir_surface: '水庫表水 reservoir surface',
  tributary_or_stream: '支流 溪流 tributary stream',
  downstream: '下游 downstream',
  summary: '平均值 摘要 average summary',
  unknown: '未分類 unknown',
};

export function parseWaterQualityValue(raw: unknown): WaterQualityValue {
  if (raw === null || raw === undefined) return { raw: '', value: null, qualifier: 'missing' };
  const text = String(raw).trim();
  if (text === '') return { raw: '', value: null, qualifier: 'missing' };
  if (text === '-') return { raw: '-', value: null, qualifier: 'missing' };
  if (/^ND$/i.test(text)) return { raw: text, value: null, qualifier: 'not_detected' };
  if (text.startsWith('<')) {
    const value = Number(text.slice(1).trim());
    return { raw: text, value: Number.isFinite(value) ? value : null, qualifier: 'less_than' };
  }
  const value = Number(text.replaceAll(',', ''));
  return Number.isFinite(value)
    ? { raw: text, value, qualifier: 'measured' }
    : { raw: text, value: null, qualifier: 'missing' };
}

export function parseRocYearMonthFromFilename(filename: string) {
  const match = filename.match(/(\d{2,3})\s*年\s*(\d{1,2})\s*月/);
  if (!match) {
    throw new Error(`Could not parse ROC year/month from ${filename}`);
  }
  const rocYear = Number(match[1]);
  const month = Number(match[2]);
  const year = rocYear + 1911;
  return { year, rocYear, month, period: `${year}-${String(month).padStart(2, '0')}` };
}

export function normalizeColumnName(raw: string): string {
  return raw.trim().replace(/\s+/g, '').replaceAll('﹙', '(').replaceAll('﹚', ')');
}

export function normalizeStationName(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

export function classifyStationGroup(stationName: string): StationGroup {
  if (['大壩上', '大壩中', '大壩下'].includes(stationName)) return 'dam_profile';
  if (['火燒樟', '後坑子', '鷺鷥潭', '小格頭', '媽祖林'].includes(stationName)) return 'reservoir_surface';
  if (['永安', '灣潭上', '灣潭中', '灣潭下', '黃櫸皮寮'].includes(stationName)) return 'tributary_or_stream';
  if (stationName === '表水平均值') return 'summary';
  return 'unknown';
}

export function getLatestPeriod(records: WaterQualityRecord[]): string {
  return [...new Set(records.map((record) => record.period))].sort().at(-1) ?? '';
}

export function filterRecords(records: WaterQualityRecord[], filters: Filters): WaterQualityRecord[] {
  const query = filters.search.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.period && record.period !== filters.period) return false;
    if (filters.stationGroup !== 'all' && record.stationGroup !== filters.stationGroup) return false;
    if (filters.stationName !== 'all' && record.stationName !== filters.stationName) return false;
    if (query) {
      const haystack = [
        record.stationName,
        record.stationGroup,
        stationGroupSearchTerms[record.stationGroup],
        filters.parameter,
        parameterSearchTerms[filters.parameter],
      ].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function aggregateStationComparison(
  records: WaterQualityRecord[],
  period: string,
  parameter: WaterQualityParameterKey,
): StationComparisonPoint[] {
  return records
    .filter((record) => record.period === period && !record.isSummaryRow)
    .map((record) => ({
      stationName: record.stationName,
      stationGroup: record.stationGroup,
      value: record.values[parameter].value,
      qualifier: record.values[parameter].qualifier,
    }));
}

function average(values: Array<number | null>): number | null {
  const numeric = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? '-' : value.toFixed(digits).replace(/\.?0+$/, '');
}

function stationByExtreme(
  records: WaterQualityRecord[],
  parameter: WaterQualityParameterKey,
  direction: 'highest' | 'lowest',
): string {
  const candidates = records
    .filter((record) => !record.isSummaryRow && record.values[parameter].value !== null)
    .sort((a, b) => {
      const diff = (a.values[parameter].value ?? 0) - (b.values[parameter].value ?? 0);
      return direction === 'highest' ? -diff : diff;
    });
  const top = candidates[0];
  if (!top) return '-';
  return `${top.stationName} ${formatNumber(top.values[parameter].value)}`;
}

export function buildWaterQualitySummary(records: WaterQualityRecord[]): WaterQualitySummary {
  const periods = [...new Set(records.map((record) => record.period))].sort();
  const latestPeriod = periods.at(-1) ?? '';
  const latestRecords = records.filter((record) => record.period === latestPeriod);
  const reservoirSurface = latestRecords.filter((record) => record.stationGroup === 'reservoir_surface');
  const surfaceAverageTurbidity = average(reservoirSurface.map((record) => record.values.turbidityNTU.value));
  const surfaceAveragePH = average(reservoirSurface.map((record) => record.values.pH.value));
  const surfaceAverageDissolvedOxygen = average(
    reservoirSurface.map((record) => record.values.dissolvedOxygenMgL.value),
  );
  const latestStationCount = new Set(latestRecords.filter((record) => !record.isSummaryRow).map((record) => record.stationName)).size;

  return {
    latestPeriod,
    periods,
    stationCount: new Set(records.map((record) => record.stationName)).size,
    latestStationCount,
    summaryCards: {
      latestPeriod: latestPeriod || '-',
      latestStationCount: String(latestStationCount),
      surfaceAverageTurbidity: formatNumber(surfaceAverageTurbidity),
      surfaceAveragePH: formatNumber(surfaceAveragePH),
      surfaceAverageDissolvedOxygen: formatNumber(surfaceAverageDissolvedOxygen),
      highestAlgaeStation: stationByExtreme(latestRecords, 'algaeCellsPerML', 'highest'),
      highestTotalPhosphorusStation: stationByExtreme(latestRecords, 'totalPhosphorusUgL', 'highest'),
      lowestTransparencyStation: stationByExtreme(latestRecords, 'transparencyM', 'lowest'),
    },
  };
}
