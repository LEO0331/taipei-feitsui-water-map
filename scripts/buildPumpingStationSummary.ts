import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPumpingStationSummary } from '../src/utils/pumpingStations';
import type { PumpingStation } from '../src/types/pumpingStations';

const publicDir = path.join(process.cwd(), 'public/data');
const records = JSON.parse(await readFile(path.join(publicDir, 'pumping-stations.json'), 'utf8')) as PumpingStation[];
await writeFile(path.join(publicDir, 'pumping-station-summary.json'), `${JSON.stringify(buildPumpingStationSummary(records), null, 2)}\n`);
