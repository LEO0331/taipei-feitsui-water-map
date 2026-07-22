import type { ReservoirSedimentationSurveyRecord, ReservoirSedimentationSurveySummary } from '../types/reservoirSedimentationSurvey';

const missing = new Set(['', '-', '--', '—', 'n/a', 'null']);
export const parseNumber = (raw: unknown, percentage = false): number | null => {
  const value = String(raw ?? '').trim();
  if (missing.has(value.toLowerCase())) return null;
  const cleaned = value.replace(/[^\d.-]/g, '');
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return percentage ? number : number < 0 ? null : number;
};

export function parseSurveyDateRange(raw: string) {
  const match = raw.replace(/\s/g, '').match(/(\d{2,4})[./-](\d{1,2})\D+(\d{2,4})[./-](\d{1,2})/);
  if (!match) return { startYear: null, startMonth: null, endYear: null, endMonth: null, endPeriod: null, endDate: null };
  const year = (value: string) => Number(value) < 1911 ? Number(value) + 1911 : Number(value);
  const [startYear, startMonth, endYear, endMonth] = [year(match[1]), Number(match[2]), year(match[3]), Number(match[4])];
  return { startYear, startMonth, endYear, endMonth, endPeriod: `${endYear}-${String(endMonth).padStart(2, '0')}`, endDate: null };
}

export function addSurveyWarnings(record: ReservoirSedimentationSurveyRecord) {
  const warnings: string[] = [];
  if (record.remainingStorageCapacityCubicMeters !== null && record.remainingStorageCapacityCubicMeters < 0) warnings.push('Negative remaining capacity');
  if (record.sedimentationVolumeCubicMeters !== null && record.sedimentationVolumeCubicMeters < 0) warnings.push('Negative sedimentation volume');
  if (record.cumulativeSedimentationRatePercent !== null && (record.cumulativeSedimentationRatePercent < 0 || record.cumulativeSedimentationRatePercent > 100)) warnings.push('Sedimentation rate outside 0–100%');
  return warnings;
}

export function buildReservoirSedimentationSurveySummary(records: ReservoirSedimentationSurveyRecord[]): ReservoirSedimentationSurveySummary {
  const dated = records.filter((record) => record.startYear !== null && record.endYear !== null).sort((a, b) => (a.endPeriod ?? '').localeCompare(b.endPeriod ?? ''));
  return { totalRecords: records.length, latest: dated.at(-1), minYear: Math.min(...dated.map((record) => record.startYear!)), maxYear: Math.max(...dated.map((record) => record.endYear!)), dataQualityWarningCount: records.reduce((sum, record) => sum + record.warnings.length, 0) };
}
