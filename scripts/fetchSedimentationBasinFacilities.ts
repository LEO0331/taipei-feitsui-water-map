import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/sedimentation-basin-facilities');
const target = path.join(rawDir, '沉砂池OK.csv');
await mkdir(rawDir, { recursive: true });
if (process.env.SEDIMENTATION_BASINS_CSV_URL) {
  const response = await fetch(process.env.SEDIMENTATION_BASINS_CSV_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
} else {
  await access(target);
}
console.log(`Sedimentation-basin source ready: ${target}`);
