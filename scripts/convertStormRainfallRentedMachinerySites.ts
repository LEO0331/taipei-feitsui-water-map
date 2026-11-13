import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StormMachineryDeploymentSite, StormMachinerySummary } from '../src/types/stormMachinery';
const rawDir = path.join(process.cwd(), 'data/raw/storm-rainfall-rented-machinery-sites'); const outDir = path.join(process.cwd(), 'public/data/storm-rainfall-rented-machinery-sites');
const parseCsv = (text: string) => { const rows: string[][] = []; let row: string[] = [], cell = '', q = false; for (let i=0;i<text.length;i+=1) { const c=text[i], n=text[i+1]; if(c==='"'&&q&&n==='"'){cell+='"';i+=1;} else if(c==='"')q=!q; else if(c===','&&!q){row.push(cell);cell='';} else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&n==='\n')i+=1;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell='';} else cell+=c; } if(cell||row.length){row.push(cell);rows.push(row);} return rows; };
const clean = (value: unknown) => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
const field = (row: Record<string,string>, ...names: string[]) => clean(names.map((name) => row[name]).find(Boolean));
const coord = (raw: string, min: number, max: number) => { const n=Number(raw); return Number.isFinite(n)&&n>=min&&n<=max ? n : null; };
const date = (raw: string) => { const m=raw.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}` : null; };
await mkdir(outDir, { recursive: true });
const seen = new Set<string>();
const records: StormMachineryDeploymentSite[] = [];

for (const file of (await readdir(rawDir)).filter(name => name.endsWith('.csv'))) {
  const csv = await readFile(path.join(rawDir, file), 'utf8');
  const [headers, ...rows] = parseCsv(csv.replace(/^\uFEFF/, ''));
  for (const values of rows) {
    const sourceValues = Object.fromEntries(headers.map((header, index) => [clean(header), clean(values[index])]));
    const objectId = field(sourceValues, 'OBJECTID', 'OBJECTID（編號）');
    const id = objectId || createHash('sha1').update(JSON.stringify(sourceValues)).digest('hex');
    if (seen.has(id)) continue;
    seen.add(id);

    const districtName = field(sourceValues, 'DISTRICT', 'DISTRICT（行政區）');
    const equipmentId = field(sourceValues, 'ENGINEID', 'ENGINEID（外租機械編號）');
    const equipmentNameRaw = field(sourceValues, 'ENGNAME', 'ENGNAME（設備名稱）');
    const contractorName = field(sourceValues, 'EFIRM', 'EFIRM（責任廠商）');
    const recordDateRaw = field(sourceValues, 'SPRECDATE');
    const usageDirection = field(sourceValues, 'SPUSEDIR');
    const longitudeRaw = field(sourceValues, 'Longitude');
    const latitudeRaw = field(sourceValues, 'Latitude');
    const longitude = coord(longitudeRaw, 121.3, 121.8);
    const latitude = coord(latitudeRaw, 24.85, 25.3);

    records.push({
      id,
      objectId,
      districtRaw: districtName,
      districtName,
      equipmentId,
      locationDescription: field(sourceValues, 'ENGLOC', 'ENGLOC（位置敘述）'),
      equipmentNameRaw,
      equipmentType: equipmentNameRaw.split(/[\d(（]/)[0].trim() || equipmentNameRaw,
      contractorName,
      recordDateRaw,
      recordDate: date(recordDateRaw),
      usageDirectionRaw: usageDirection,
      usageDirection,
      longitudeRaw,
      latitudeRaw,
      longitude,
      latitude,
      hasValidCoordinates: longitude !== null && latitude !== null,
      hasEquipmentId: Boolean(equipmentId),
      hasContractor: Boolean(contractorName),
      hasUsageDirection: Boolean(usageDirection),
    });
  }
}

const groups=[...new Set(records.map((r)=>r.districtName).filter(Boolean))].map((district)=>{const items=records.filter((r)=>r.districtName===district);return {district,records:items.length,equipmentIds:new Set(items.map((r)=>r.equipmentId).filter(Boolean)).size,equipmentTypes:new Set(items.map((r)=>r.equipmentType).filter(Boolean)).size,contractors:new Set(items.map((r)=>r.contractorName).filter(Boolean)).size};}); const dates=records.map((r)=>r.recordDate).filter((v):v is string=>Boolean(v)); const summary:StormMachinerySummary={totalRecords:records.length,validCoordinateCount:records.filter((r)=>r.hasValidCoordinates).length,districtCount:groups.length,equipmentTypeCount:new Set(records.map((r)=>r.equipmentType).filter(Boolean)).size,contractorCount:new Set(records.map((r)=>r.contractorName).filter(Boolean)).size,latestRecordDate:dates.sort().at(-1)??null,coverageEndDate:dates.sort().at(-1)??null,byDistrict:groups}; const geojson={type:'FeatureCollection',features:records.filter((r)=>r.hasValidCoordinates).map((r)=>({type:'Feature',geometry:{type:'Point',coordinates:[r.longitude,r.latitude]},properties:r}))}; await writeFile(path.join(outDir,'records.json'),`${JSON.stringify(records,null,2)}\n`);await writeFile(path.join(outDir,'metadata.json'),`${JSON.stringify(summary,null,2)}\n`);await writeFile(path.join(outDir,'sites.geojson'),`${JSON.stringify(geojson,null,2)}\n`);console.log(`Converted ${records.length} machinery site record(s).`);
