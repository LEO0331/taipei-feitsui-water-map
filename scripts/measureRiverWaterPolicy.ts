import { readFile, readdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { buildPolicyCandidates, runPolicyScenario, makePolicyBriefing, policyBriefingJson, policyBriefingCsv } from '../src/utils/riverWaterPolicyScenarios';
import { verifyPolicyBytes } from '../src/utils/riverWaterPolicy';

const pointer = JSON.parse(await readFile('public/data/river-water-policy/current.json', 'utf8'));
const bytes = await readFile(`public/data/river-water-policy/${pointer.file}`);
const started = performance.now();
const snapshot = await verifyPolicyBytes(pointer, bytes);
const validationMs = performance.now() - started;
const candidates = buildPolicyCandidates(snapshot);
const timings = Array.from({ length: 50 }, () => {
  const start = performance.now(); runPolicyScenario(candidates, 'balanced', 10); return performance.now() - start;
}).sort((a, b) => a - b);
const assets = [];
for (const file of await readdir('dist/assets')) if (/^(index-.*\.js|RiverWaterPolicyDashboard-.*\.(js|css))$/.test(file)) {
  const content = await readFile(`dist/assets/${file}`); assets.push({ file, bytes: content.length, gzipBytes: gzipSync(content).length });
}
const exports = [];
for (const config of [{ mode: 'A' as const }, { mode: 'B' as const, evidence: 'limited' as const }, { mode: 'C' as const }]) {
  const result = runPolicyScenario(buildPolicyCandidates(snapshot, config), 'balanced', 'all');
  const briefing = makePolicyBriefing(snapshot, config, result, pointer);
  exports.push({ config, eligible: result.eligiblePopulation, jsonBytes: Buffer.byteLength(policyBriefingJson(briefing)), csvBytes: Buffer.byteLength(policyBriefingCsv(briefing)) });
}
const results = { snapshotId: pointer.snapshotId, runtime: process.version, environment: `${process.platform}/${process.arch}`, note: 'One local Node run; scenario timing is pure calculation, not browser interaction or network latency. Fifty repetitions, no hardware-normalized benchmark claim.', assets, snapshotBytes: bytes.length, snapshotGzipBytes: gzipSync(bytes).length, nodeValidationMs: validationMs, balancedCapacity10: { runs: timings.length, medianMs: timings[25], p95Ms: timings[47] }, exports };
await writeFile('docs/evidence/river-water-policy/performance.json', `${JSON.stringify(results, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
