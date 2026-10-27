# Policy #13 implementation and verification plan

Baseline: main `94b460758bda198bd1b83a0e7839814a944898ec`, 2026-10-27 (Asia/Taipei). Branch: `codex/river-water-longitudinal-policy-13`. One feature: `feat-022`. Policy #14 is outside scope.

1. Retain independent original annual CSV and official contextual HTML editions. Verify catalogue IDs, byte hashes, encoding, schema and row identities; stage refreshes and accept explicitly. Preserve the original river explorer inputs.
2. Audit every published station-month and all 27 indicator cells. Separate measured/censored values, absent values and future placeholders. Disclose assumed monthly opportunities and unknown commissioning history.
3. Preserve river + station labels and source-bound row IDs. Current station-name matching does not establish historical physical continuity. Admit only supported comparisons; disclose limited same-label pairs separately. Keep RPI unavailable if official precision/rounding cannot be established.
4. Build deterministic Mode A/B/C gates, two strategies on identical populations, capacities 5/10/all, actual-ID sensitivity and safe JSON/CSV briefings.
5. Publish an immutable, exactly hashed static snapshot via an atomic validated pointer. Add a lazy bilingual panel to existing navigation with local-only data, accessible controls and measured-only charts with gaps.
6. Run source, engine, scenario and export regression tests; reproduce exact snapshot bytes twice; verify failed rebuild retains pointer. Run full startup equivalents and normal/Pages builds. Audit existing generated-data churn before delivery.
7. Browser QA at 320/390/768/1024/1440 px; inspect both languages, navigation, filtering, scenarios, downloads, errors/retry, keyboard focus, console and data requests. Record actual sizes and timings without treating them as benchmarks.
8. Record results and limits in requested research documents, feature tracker and continuity logs. Commit using Lore trailers and create one reviewable unmerged PR.

## Baseline evidence

`bash ./init.sh` failed with `Bash/E_ACCESSDENIED`. Initial sandboxed `npm ci` failed with filesystem EPERM; the authorized unsandboxed retry succeeded (121 packages, zero audit vulnerabilities). All equivalent startup steps then passed: `npm ci`, `npm run convert:data`, `npm test` (65 tests plus TypeScript), `npm run build`, `GITHUB_PAGES=true npm run build`. Logs are under `docs/evidence/river-water-policy/baseline-*.log`. No lint script exists. The existing large-chunk warning remains.

## Acceptance gates

- No fabricated station continuity, coordinates, sampling days, imputed laboratory values, regulatory conclusions or causation.
- Future placeholders never count as observations or overdue samples.
- Insufficient evidence is a valid result; no forced RPI, trend or tier population.
- Network acquisition is scoped and opt-in; ordinary verification is offline.
- Existing heavy-rain and other modules retain their inputs and conclusions.
