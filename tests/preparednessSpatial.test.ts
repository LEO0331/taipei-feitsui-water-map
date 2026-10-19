import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildPreparednessDecisionSnapshot, preparednessCsv, validatePreparednessSnapshot } from '../scripts/buildPreparednessDecisionSnapshot';
import { convertTwd97ToWgs84 } from '../src/utils/pumpingStations';
import { geometryIdentity, inTaipeiBounds, normalizeEventDate, parsePreparednessKml, preparednessDistrict, ringIssue } from '../src/utils/preparednessSpatial';

const ring = [[121.5, 25], [121.51, 25], [121.51, 25.01], [121.5, 25]];
const polygon = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring.map((p) => p.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const kml = (geometry: string) => `<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><ExtendedData><SchemaData><SimpleData name="DISTRICT">北投區</SimpleData></SchemaData></ExtendedData>${geometry}</Placemark></Document></kml>`;
test('KML polygon and MultiGeometry are parsed with source attributes and original precision', () => {
  const single = parsePreparednessKml(kml(polygon))[0];
  assert.deepEqual(single.issues, []); assert.equal(single.geometry?.type, 'Polygon'); assert.equal(single.attributes.DISTRICT, '北投區');
  const separate = polygon.replaceAll('121.5,','121.53,').replaceAll('121.51,','121.54,');
  assert.equal(parsePreparednessKml(kml(`<MultiGeometry>${polygon}${separate}</MultiGeometry>`))[0].geometry?.type, 'MultiPolygon');
  assert.ok(parsePreparednessKml(kml(`<MultiGeometry>${polygon}${polygon}</MultiGeometry>`))[0].issues.includes('overlapping_polygon_components'));
  assert.throws(() => parsePreparednessKml('<!DOCTYPE kml><kml/>'), /Unsupported/);
  assert.throws(() => parsePreparednessKml(kml(polygon).replace('</kml>', '')), /incomplete/);
  assert.equal(parsePreparednessKml(kml('<Point><coordinates>121.5,25</coordinates></Point>'))[0].geometry, null);
});
test('Invalid/self-intersecting, missing, out-of-bounds and unclosed geometry fail closed', () => {
  assert.equal(ringIssue([[121.5,25],[121.6,25.1],[121.5,25.1],[121.6,25],[121.5,25]]), 'self_intersection');
  assert.equal(ringIssue([[0,0],[1,0],[1,1],[0,0]]), 'outside_taipei_bounds');
  assert.equal(ringIssue(ring.slice(0,-1)), 'unclosed_or_short_ring');
  assert.equal(parsePreparednessKml(kml('<Polygon></Polygon>'))[0].geometry, null);
  assert.equal(inTaipeiBounds(NaN,25), false);
});
test('Duplicate geometry identity ignores ring start and orientation', () => {
  assert.equal(geometryIdentity({ type:'Polygon',coordinates:[ring] }), geometryIdentity({ type:'Polygon',coordinates:[[ring[2],ring[1],ring[0],ring[2]]] }));
});
test('TWD97 conversion, district and event date validation are explicit', () => {
  const point = convertTwd97ToWgs84(303357.64,2773912.6);
  assert.ok(Math.abs(point.longitude-121.52891347)<1e-7); assert.ok(inTaipeiBounds(point.longitude,point.latitude));
  assert.equal(preparednessDistrict('未知區'),null); assert.equal(normalizeEventDate('2024/2/29'),'2024-02-29');
  assert.equal(normalizeEventDate('2025/2/29'),null); assert.equal(normalizeEventDate(''),null);
});
test('Snapshot reproduces exactly, selects a single machinery edition, aggregates dates without unique-event claims and minimizes contact data', async () => {
  const first = await buildPreparednessDecisionSnapshot(process.cwd(), false), second = await buildPreparednessDecisionSnapshot(process.cwd(), false);
  assert.deepEqual(first,second);
  assert.deepEqual(first.snapshot,JSON.parse(await readFile('public/data/preparedness-decision/snapshot.json','utf8')));
  assert.deepEqual(first.snapshot.inventory.reduce((counts,r)=>({...counts,[r.assetType]:(counts[r.assetType]??0)+1}),{} as Record<string,number>),{pumping:88,machinery:73,basin:67});
  assert.equal(first.snapshot.reviewAreas.length,9);
  assert.equal(first.snapshot.sources.find((s)=>s.sourceId==='historical-inundation')?.recordCount,695);
  assert.equal(first.snapshot.sources.find((s)=>s.sourceId==='historical-inundation')?.rejectedCount,44);
  assert.equal(new Set(first.snapshot.reviewAreas.map((r)=>r.district)).size<12,true);
  assert.ok(first.snapshot.historicalByDistrict.some((d)=>d.observationCount>d.distinctDateCount));
  assert.ok(first.report.issues.some((i)=>i.reasons.includes('duplicate_observation_geometry')));
  assert.ok(first.snapshot.inventory.filter((r)=>r.assetType==='machinery').every((r)=>r.qualityFlags.includes('missing_record_date')));
  assert.ok(first.snapshot.inventory.every((r)=>r.qualityFlags.includes('catchment_relationship_unverified')));
  const allowedInventory = ['id','sourceId','assetType','district','name','longitude','latitude','coordinateStatus','qualityFlags'];
  assert.ok(first.snapshot.inventory.every((r)=>Object.keys(r).every((k)=>allowedInventory.includes(k))));
  assert.doesNotMatch(JSON.stringify(first),/responsibleOfficerName|officePhone|mobilePhone|contractorName|sourceValues|ADDRESS|EMAN|EFIRM|行動電話/);
  const invalid = structuredClone(first.snapshot); invalid.reviewAreas[0].sourceId='pumping'; assert.throws(()=>validatePreparednessSnapshot(invalid),/Geometry\/source/);
});
async function fixture() {
  const root = await mkdtemp(path.join(process.cwd(),'.preparedness-test-'));
  const manifest = JSON.parse(await readFile('data/raw/preparedness-decision/source-manifest.json','utf8'));
  for (const entry of manifest.sources) { const target=path.join(root,entry.localPath); await mkdir(path.dirname(target),{recursive:true}); await writeFile(target,await readFile(entry.localPath)); }
  const manifestPath=path.join(root,'data/raw/preparedness-decision/source-manifest.json'); await writeFile(manifestPath,JSON.stringify(manifest));
  return {root,manifest,manifestPath};
}
async function removeFixture(root: string) {
  assert.ok(path.resolve(root).startsWith(path.resolve(process.cwd()) + path.sep));
  assert.ok(path.basename(root).startsWith('.preparedness-test-'));
  await rm(root,{recursive:true,force:true});
}
test('Bad source bytes and unsupported/mixed editions preserve the previous-good public snapshot', async () => {
  const f=await fixture();
  try {
    await buildPreparednessDecisionSnapshot(f.root);
    const target=path.join(f.root,'public/data/preparedness-decision/snapshot.json'), previous=await readFile(target,'utf8');
    await writeFile(path.join(f.root,f.manifest.sources[0].localPath),'corrupt');
    await assert.rejects(()=>buildPreparednessDecisionSnapshot(f.root),/hash mismatch/);
    assert.equal(await readFile(target,'utf8'),previous);
    f.manifest.sources.find((s:{sourceId:string})=>s.sourceId==='machinery').version='2025+2026'; await writeFile(f.manifestPath,JSON.stringify(f.manifest));
    await assert.rejects(()=>buildPreparednessDecisionSnapshot(f.root),/edition/); assert.equal(await readFile(target,'utf8'),previous);
    f.manifest.sources.find((s:{sourceId:string})=>s.sourceId==='machinery').version='115年度/2026';
    f.manifest.sources[0].resourceId=f.manifest.sources[1].resourceId;
    await writeFile(f.manifestPath,JSON.stringify(f.manifest));
    await assert.rejects(()=>buildPreparednessDecisionSnapshot(f.root),/Source identity/); assert.equal(await readFile(target,'utf8'),previous);
  } finally { await removeFixture(f.root); }
});
test('Missing official KMLs leave Mode A inventory intact and explicitly disable Mode B', async () => {
  const f=await fixture();
  try {
    for(const source of f.manifest.sources.filter((s:{sourceId:string})=>['flood-prone','historical-inundation'].includes(s.sourceId))) await rm(path.join(f.root,source.localPath));
    const {snapshot}=await buildPreparednessDecisionSnapshot(f.root,false);
    assert.equal(snapshot.inventory.length,228); assert.equal(snapshot.floodContextAvailable,false);
    assert.equal(snapshot.reviewAreas.length,0); assert.equal(snapshot.historicalByDistrict.length,0);
    assert.equal(snapshot.sources.filter((s)=>s.status==='unavailable').length,2);
  } finally { await removeFixture(f.root); }
});
test('Facility duplicate IDs are audited, while missing dates/coordinates and unknown districts remain explicit gaps', async () => {
  const f=await fixture();
  try {
    const entry=f.manifest.sources.find((s:{sourceId:string})=>s.sourceId==='pumping');
    const rows=preparednessCsv(await readFile(path.join(f.root,entry.localPath),'utf8'));
    rows[0]['X坐標']=''; rows[0]['建置日期']=''; rows[0]['行政區域']='未知區'; rows.push({...rows[1]});
    const headers=Object.keys(rows[0]), quote=(s:string)=>`"${s.replaceAll('"','""')}"`;
    const bytes=Buffer.from([headers.map(quote).join(','),...rows.map((r)=>headers.map((h)=>quote(r[h])).join(','))].join('\n'));
    await writeFile(path.join(f.root,entry.localPath),bytes); entry.sourceSha256=createHash('sha256').update(bytes).digest('hex');entry.byteLength=bytes.length;
    await writeFile(f.manifestPath,JSON.stringify(f.manifest));
    const {snapshot,report}=await buildPreparednessDecisionSnapshot(f.root,false);
    const first=snapshot.inventory.find((r)=>r.id==='pumping:1')!;
    assert.equal(first.district,null);assert.equal(first.coordinateStatus,'missing');assert.equal(first.longitude,undefined);
    assert.ok(first.qualityFlags.includes('missing_established_date'));assert.ok(first.qualityFlags.includes('unknown_district'));
    assert.equal(snapshot.sources.find((s)=>s.sourceId==='pumping')?.rejectedCount,1);
    assert.ok(report.issues.some((i)=>i.reasons.includes('duplicate_identity')));
  } finally { await removeFixture(f.root); }
});
