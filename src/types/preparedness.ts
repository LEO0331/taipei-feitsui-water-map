export type PreparednessGeometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
export type PreparednessSource = {
  sourceId: string; datasetId: string; resourceId: string | null; sourceUrl: string;
  publicationDate: string | null; retrievedAt: string | null; sourceSha256: string;
  version: string; status: 'verified' | 'unavailable' | 'limited';
  recordCount: number; rejectedCount: number; limitations: string[];
  publisher?: string; coordinateSystem?: 'EPSG:3826' | 'EPSG:4326';
  sourceSchema?: string; temporalCoverage?: { start: string | null; end: string | null };
};
export type PreparednessInventory = {
  id: string; sourceId: string; assetType: 'pumping' | 'machinery' | 'basin';
  district: string | null; name: string; longitude?: number; latitude?: number;
  coordinateStatus: 'verified' | 'missing' | 'invalid'; qualityFlags: string[];
};
export type PreparednessReviewArea = { id: string; district: string | null; geometry: PreparednessGeometry; sourceId: string };
export type PreparednessHistoricalDistrict = {
  district: string; sourceId: string; observationCount: number; distinctDateCount: number; eventDates: string[];
};
export type PreparednessSnapshot = {
  schemaVersion: '1.0.0'; methodologyVersion: 'heavy-rain-preparedness-review-v1';
  snapshotVersion: string; processedAt: string; sources: PreparednessSource[];
  inventory: PreparednessInventory[]; reviewAreas: PreparednessReviewArea[];
  historicalByDistrict: PreparednessHistoricalDistrict[]; limitations: string[];
  geographyReason: string; floodContextAvailable: boolean;
};
