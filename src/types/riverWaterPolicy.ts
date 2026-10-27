import type { RiverIndicatorKey, RiverWaterQualityValue, WaterValueQualifier } from './riverWaterQuality';
import type { PolicyCandidate, PolicyScenario } from '../utils/riverWaterPolicyScenarios';

export const POLICY_METHOD = 'river-water-longitudinal-evidence-review-v1';
export type PolicySource = {
  sourceId: string; datasetId: string; resourceId: string; catalogueUrl: string; downloadUrl: string;
  publisher: string; yearRoc: number; year: number; updatedAt: string; retrievedAt: string;
  sha256: string; byteLength: number; encoding: string; columns: string[]; admissionStatus: string;
};
export type PolicyStation = {
  stationId: string; riverName: string; stationName: string; rawLabels?: string[];
  identityStatus: 'label_verified' | 'ambiguous' | 'unmatched'; physicalContinuity: 'unverified' | 'verified';
  coordinateStatus: string; evidenceUrls: string[];
};
export type PolicyRowStatus = 'valid_observed' | 'partially_observed' | 'present_no_indicators' | 'future_placeholder' | 'historical_missing' | 'unparseable' | 'duplicate';
export type PolicyRow = {
  id: string; sourceId: string; sourceSha256: string; rowNumber: number; yearRoc: number; year: number;
  month: number; period: string; riverName: string; stationName: string; stationId: string;
  identityStatus: PolicyStation['identityStatus']; status: PolicyRowStatus;
  values: Record<RiverIndicatorKey, RiverWaterQualityValue>; issues: string[];
  completeFourIndicators: boolean; rpiEligible: false;
};
export type PolicyQualifiers = Record<WaterValueQualifier, number> & { invalid: number; exactEligible: number };
export type PolicyCoverage = {
  stationId: string; riverName: string; stationName: string; firstPeriod: string; lastPeriod: string;
  expectedStationMonthCount: number; publishedRowCount: number; observedRowCount: number;
  missingStationMonthCount: number; placeholderCount: number; partiallyMeasuredRowCount: number;
  completeFourIndicatorCount: number; futureOpportunityCount: number;
  indicatorCoverage: Record<RiverIndicatorKey, PolicyQualifiers>;
  periods: Array<{ period: string; rowIds: string[]; status: PolicyRowStatus | 'absent'; expected: boolean }>;
};
export type PolicyComparison = {
  id: string; stationId: string; riverName: string; stationName: string; indicator: RiverIndicatorKey;
  fromYear: number; toYear: number; matchedCount: number; excludedCount: number;
  pairs: Array<{ month: number; fromId: string; toId: string; fromValue: number; toValue: number; change: number }>;
  strictEligible: boolean; limitedEligible: boolean; exclusionReasons: string[];
};
export type PolicySnapshot = {
  schemaVersion: '1.0.0'; methodId: typeof POLICY_METHOD; analysisDate: string;
  sources: PolicySource[]; stations: PolicyStation[]; rows: PolicyRow[]; coverage: PolicyCoverage[];
  context?: Array<{ sourceId: string; sourceUrl: string; sha256: string; byteLength: number; retrievedAt: string }>;
  qualifierCounts: Record<RiverIndicatorKey, PolicyQualifiers>; comparisons: PolicyComparison[];
  rpi: { available: false; label: 'Research-reproduced RPI'; completeInputCount: number; eligibleCount: 0; excludedCount: number; blockers: string[]; officialMethodUrl: string };
  totals: { publishedRowCount: number; observedRowCount: number; completeFourIndicatorCount: number;
    partiallyMeasuredRowCount: number; placeholderCount: number; futurePlaceholderCount: number;
    expectedStationMonthCount: number; missingStationMonthCount: number; censoredValueCount: number;
    duplicateCount: number; unparseableRowCount: number; strictComparisonCount: number; limitedComparisonCount: number; matchedPairCount: number };
  limitations: string[];
  analysis?: { candidates: PolicyCandidate[]; scenarios: Array<Omit<PolicyScenario, 'selected' | 'excluded'> & { excludedIds: string[] }>; sensitivity: unknown };
};
export type PolicyPointer = { schemaVersion: '1.0.0'; methodId: typeof POLICY_METHOD; snapshotId: string; sha256: string; byteLength: number; file: string };
