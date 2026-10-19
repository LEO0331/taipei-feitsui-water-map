import type { PreparednessGeometry } from '../types/preparedness';

export const TAIPEI_DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'];
export function preparednessDistrict(value: string): string | null { return TAIPEI_DISTRICTS.includes(value.trim()) ? value.trim() : null; }
export function inTaipeiBounds(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude) && Number.isFinite(latitude) && longitude >= 121.43 && longitude <= 121.70 && latitude >= 24.90 && latitude <= 25.25;
}
export function normalizeEventDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match, value = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
const cross = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
function intersects(a: number[], b: number[], c: number[], d: number[]): boolean {
  const on = (p: number[], q: number[], r: number[]) => cross(p, q, r) === 0 && r[0] >= Math.min(p[0], q[0]) && r[0] <= Math.max(p[0], q[0]) && r[1] >= Math.min(p[1], q[1]) && r[1] <= Math.max(p[1], q[1]);
  return (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
export function ringIssue(ring: number[][]): string | null {
  if (ring.length < 4 || !same(ring[0], ring[ring.length - 1])) return 'unclosed_or_short_ring';
  if (ring.some((p) => p.length !== 2 || !inTaipeiBounds(p[0], p[1]))) return 'outside_taipei_bounds';
  if (new Set(ring.slice(0, -1).map(String)).size < 3) return 'degenerate_ring';
  for (let i = 0; i < ring.length - 1; i += 1) {
    if (same(ring[i], ring[i + 1])) return 'duplicate_adjacent_vertex';
    for (let j = i + 2; j < ring.length - 1; j += 1) {
      if (i === 0 && j === ring.length - 2) continue;
      if (intersects(ring[i], ring[i + 1], ring[j], ring[j + 1])) return 'self_intersection';
    }
  }
  const area = ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0);
  return Math.abs(area) < 1e-14 ? 'zero_area_ring' : null;
}
export function geometryIdentity(geometry: PreparednessGeometry): string {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return JSON.stringify(polygons.map((polygon) => polygon.map((ring) => {
    const points = ring.slice(0, -1).map((p) => JSON.stringify(p));
    const rotations = [points, [...points].reverse()].flatMap((direction) => direction.map((_, i) => JSON.stringify([...direction.slice(i), ...direction.slice(0, i)])));
    return rotations.sort()[0];
  }).sort()).sort());
}
function pointInsideRing(point: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i, i += 1) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Conservative planar validation: holes and touching/overlapping components fail closed. */
export function geometryIssue(geometry: PreparednessGeometry): string | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!polygons.length) return 'missing_polygon_geometry';
  for (const polygon of polygons) {
    if (!polygon.length) return 'missing_polygon_ring';
    if (polygon.length > 1) return 'hole_topology_not_verified';
    const issue = ringIssue(polygon[0]); if (issue) return issue;
  }
  for (let i = 0; i < polygons.length; i += 1) {
    for (let j = i + 1; j < polygons.length; j += 1) {
      const a = polygons[i][0], b = polygons[j][0];
      if (pointInsideRing(a[0], b) || pointInsideRing(b[0], a)) return 'overlapping_polygon_components';
      for (let x = 0; x < a.length - 1; x += 1) for (let y = 0; y < b.length - 1; y += 1) {
        if (intersects(a[x], a[x + 1], b[y], b[y + 1])) return 'overlapping_polygon_components';
      }
    }
  }
  return null;
}
const decode = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
export type ParsedPreparednessKml = { index: number; attributes: Record<string, string>; geometry: PreparednessGeometry | null; issues: string[] };
/** A deliberately narrow KML 2.2 Polygon/MultiGeometry reader; no entity/network expansion. Unknown geometry fails closed. */
export function parsePreparednessKml(xml: string): ParsedPreparednessKml[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<kml\b[^>]*xmlns="http:\/\/www.opengis.net\/kml\/2.2"/.test(xml) || !/<\/kml>\s*$/.test(xml)) throw new Error('Unsupported or incomplete KML document');
  const placemarks = [...xml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g)];
  if (!placemarks.length || (xml.match(/<Placemark\b/g) ?? []).length !== placemarks.length) throw new Error('Missing or incomplete KML placemarks');
  return placemarks.map((match, index) => {
    const block = match[1], attributes = Object.fromEntries([...block.matchAll(/<SimpleData\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/SimpleData>/g)].map((m) => [m[1], decode(m[2])]));
    const polygons: number[][][][] = [], issues: string[] = [];
    if (/<(?:Point|LineString|Model|Track)\b/.test(block)) issues.push('unsupported_geometry');
    for (const polygon of block.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/g)) {
      const rings: number[][][] = [];
      const boundaryBlocks = [...polygon[1].matchAll(/<(outerBoundaryIs|innerBoundaryIs)>([\s\S]*?)<\/\1>/g)];
      if (boundaryBlocks[0]?.[1] !== 'outerBoundaryIs' || boundaryBlocks.filter((b) => b[1] === 'outerBoundaryIs').length !== 1) issues.push('invalid_polygon_boundary');
      for (const boundary of boundaryBlocks) {
        const values = boundary[2].match(/<coordinates>([\s\S]*?)<\/coordinates>/)?.[1]?.trim();
        const ring = values ? values.split(/\s+/).map((v) => v.split(',').slice(0, 2).map(Number)) : [];
        const issue = ringIssue(ring); if (issue) issues.push(issue); rings.push(ring);
      }
      if (!rings.length) issues.push('missing_polygon_ring');
      // Holes and separate components are retained but not published unless their topology can be established.
      if (rings.length > 1) issues.push('hole_topology_not_verified');
      polygons.push(rings);
    }
    if (!polygons.length) issues.push('missing_polygon_geometry');
    const geometry: PreparednessGeometry | null = issues.length ? null : polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons };
    if (geometry) { const issue = geometryIssue(geometry); if (issue) issues.push(issue); }
    return { index: index + 1, attributes, geometry: issues.length ? null : geometry, issues: [...new Set(issues)] };
  });
}
