import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rawDir = path.join(process.cwd(), 'data/raw/pumping-stations');
const target = path.join(rawDir, '臺北市水利處抽水站TWD97.csv');
await mkdir(rawDir, { recursive: true });
if (process.env.PUMPING_STATIONS_CSV_URL) {
  const response = await fetch(process.env.PUMPING_STATIONS_CSV_URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
} else {
  await access(target); // Local uploaded CSV is the default offline source.
}
console.log(`Pumping-station source ready: ${target}`);
