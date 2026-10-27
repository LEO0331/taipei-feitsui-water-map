import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildRiverWaterPolicySnapshot } from './buildRiverWaterPolicySnapshot';
import { verifyPolicyBytes } from '../src/utils/riverWaterPolicy';

export async function verifyRiverWaterPolicy(root = process.cwd()) {
  const first = await buildRiverWaterPolicySnapshot(root, false), second = await buildRiverWaterPolicySnapshot(root, false);
  if (first.bytes !== second.bytes || JSON.stringify(first.pointer) !== JSON.stringify(second.pointer)) throw new Error('Non-deterministic policy snapshot');
  const pointer = JSON.parse(await readFile(path.join(root, 'public/data/river-water-policy/current.json'), 'utf8'));
  if (JSON.stringify(pointer) !== JSON.stringify(first.pointer)) throw new Error('Published policy pointer differs from offline rebuild');
  const snapshot = await verifyPolicyBytes(pointer, await readFile(path.join(root, 'public/data/river-water-policy', pointer.file)));
  if (JSON.stringify(snapshot) !== JSON.stringify(first.snapshot)) throw new Error('Published content differs from offline rebuild');
  console.log(`Verified exact bytes and repeat rebuild: ${pointer.snapshotId}; ${pointer.byteLength} bytes.`);
  return first;
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/verifyRiverWaterPolicy.ts')) verifyRiverWaterPolicy().catch(error => { console.error(error); process.exitCode = 1; });
