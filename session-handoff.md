# Session Handoff

## Current Objective

- Goal: Maintain a reviewed, restartable static water-quality map project.
- Current status: Existing reservoir modules and the separate Taipei river-water module are complete and verified.
- Branch / commit: Current working tree has uncommitted project files.

## Completed This Session

- [x] Created `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, and `init.sh`.
- [x] Replaced generic feature placeholders with current project state.
- [x] Documented static-app scope, coordinate policy, data semantics, and GitHub Pages verification.
- [x] Fixed code-review findings in chart aggregation, language persistence, data-load errors, search, and fetcher robustness.
- [x] Added regression tests and completed a bounded cleanup pass for utilities, dashboard duplication, and fetcher completion handling.
- [x] Added hydrometeorological fetching, conversion, dashboard charts, combined context tab, table modes, translations, README updates, and PWA cache entries.
- [x] Fixed hydromet review findings: added weekday/weekend and ISO date-range filters, shared those filters with charts and table rows, and removed obsolete table code.
- [x] Added reservoir-operation resource fetching, conversion, models, tests, operation dashboard tab, combined context comparisons, data table modes, cache entries, and README updates.
- [x] Added four years of Taipei river-water CSV data, qualifier-aware conversion, summaries, bilingual river dashboard/table, optional verified locations, cache entries, and README updates.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Harness validation | `node /Users/Leo/.agents/skills/harness-creator/scripts/validate-harness.mjs --target /Users/Leo/Documents/taipei-feitsui-water-map` | Passed | 100/100 overall; all five subsystems 5/5. |
| Full init | `./init.sh` | Passed | Ran install, conversion, type check, local build, and Pages build. |
| Data conversion | `npm run convert:data` | Passed | 1,764 records across 126 periods. |
| Unit tests + type check | `npm test` | Passed | 5 node:test regression tests plus `tsc --noEmit`. |
| Local build | `npm run build` | Passed | Vite chunk-size warning remains. |
| Pages build | `GITHUB_PAGES=true npm run build` | Passed | Verifies project subpath URLs. |
| Production audit | `npm audit --omit=dev` | Passed | 0 production vulnerabilities. |
| Operation fetch | `npm run fetch:operation` | Passed | Fetched or reused 130 operation resources. |
| Operation conversion | `npm run convert:operation` | Passed | Generated 3,961 daily records across 130 periods. |
| Operation tests/build | `npm test`; `npm run build` | Passed | 14 tests passed; build passed with existing large chunk warning. |
| River conversion | `npm run data:convert:river-water` | Passed | 768 records, 9 rivers, 16 stations, 48 year-month periods, 0 unparsed values. |
| River UI smoke | In-app browser | Passed | Filters, ND display, English labels, mobile containment, and 0 console errors. |
| Browser smoke | In-app browser at `http://127.0.0.1:5173/` | Passed | 126 period options, no console errors, Chinese search checks passed. |
| Hydromet fetch | `npm run fetch:hydromet` | Passed | Fetched/reused known resource `27adec48-2a1e-4897-a285-86a01e6c15ff`. |
| Hydromet conversion | `npm run convert:hydromet` | Passed | 31 daily records across 1 period, 0 conversion issues. |
| Hydromet UI smoke | In-app browser | Passed | Hydromet tab/cards/charts, combined notice, table mode, and English labels verified. |
| Hydromet filter smoke | In-app browser | Passed | Weekend range `2026-01-10` to `2026-01-18` returned exactly 4 daily rows and 0 console errors. |
| Code-review follow-up init | `./init.sh` | Passed | Re-ran after filter fixes; conversion, 10 tests, local build, and Pages build passed. |
| Production audit | `npm audit --omit=dev` | Passed | 0 production vulnerabilities. |

## Files Changed

- `AGENTS.md`
- `feature_list.json`
- `progress.md`
- `session-handoff.md`
- `init.sh`
- `src/App.tsx`
- `src/utils/waterQuality.ts`
- `scripts/fetchFeitsuiWaterResources.ts`
- `tests/waterQuality.test.ts`
- `package.json`
- `scripts/fetchFeitsuiHydrometResources.ts`
- `scripts/convertFeitsuiHydromet.ts`
- `src/types/hydromet.ts`
- `src/utils/hydromet.ts`
- `tests/hydromet.test.ts`
- `src/data/i18n.ts`
- `public/sw.js`
- `README.md`
- `src/App.tsx` and `src/data/i18n.ts` for hydromet review filter fixes.
- `src/types/operation.ts`
- `src/utils/operation.ts`
- `scripts/fetchFeitsuiOperationResources.ts`
- `scripts/convertFeitsuiOperation.ts`
- `tests/operation.test.ts`
- `data/raw/feitsui-operation/`
- `public/data/operation-daily-records.json`
- `public/data/operation-monthly-summary.json`
- `public/data/operation-parameter-series.json`
- `public/data/operation-conversion-report.json`
- `data/raw/river-water-quality/`
- `src/types/riverWaterQuality.ts`
- `src/utils/riverWaterQuality.ts`
- `src/RiverWaterQualityPanel.tsx`
- `scripts/fetchRiverWaterQuality.ts`
- `scripts/convertRiverWaterQuality.ts`
- `scripts/buildRiverWaterQualitySummary.ts`
- `tests/riverWaterQuality.test.ts`
- `public/data/river-water-quality-records.json`
- `public/data/river-water-quality-summary.json`
- `public/data/water-dashboard-summary.json`
- `public/data/river-station-locations.json`

## Decisions Made

- Keep the root instruction file short and project-specific.
- Use `feature_list.json` as the active scope source of truth.
- Keep full verification explicit in `init.sh`; use `npm run fetch:data` only for data-refresh tasks.
- Dashboard trend charts aggregate monthly values rather than connecting every station row as one line.
- Data refresh should continue when individual resources fail and record errors in `resource-index.json`.
- Full resource refresh should now fail only when zero resources are fetched, after writing diagnostic errors.
- Hydromet data is daily weather-station context; do not force it into water-quality station records or map markers without verified weather-station coordinates.
- Combined dashboard is contextual comparison only and must not claim causation, prediction, drinking-water safety, or pollution status.
- Hydromet daily filters live above the hydromet tab but apply to both hydromet charts and the data table so daily views stay consistent.
- Operation data is daily reservoir-operation context and must not be used to make operational-quality, safety, prediction, pollution, or causation claims.
- River station markers must remain absent until manually verified coordinates are added to `public/data/river-station-locations.json`.
- Support-to-TWC source CSVs are annual daily rows; keep monthly aggregation in conversion and do not invent units beyond the source `水量` wording.
- Support-to-TWC verification passed through `./init.sh`; browser smoke was not completed because no usable local browser was available from the sandbox.
- Park water-safety source metadata says TWD97, but current CSV values are WGS84-like. Keep defensive coordinate detection and only render valid WGS84 coordinates.
- Park water-safety final verification passed through `./init.sh`; browser smoke was not completed because no usable local browser was available from the sandbox.
- Treatment plant clear-water quality is a table/chart module because the CSV has no official coordinates. Do not geocode it, add near-me, or claim household tap-water or real-time drinking-water safety.
- Clear-water official forced fetch could not parse a CSV URL from the Taipei Open Data page shape, so the fetch script records that warning and reuses the uploaded local CSV. Conversion produced 568 records from 71 test items across 8 site columns.
- Clear-water final verification passed: local/forced fetch fallback, conversion, `npm test`, `./init.sh`, normal build, Pages build, `npm audit --omit=dev`, and `git diff --check`.

## Blockers / Risks

- Verified station coordinates are still missing by design.
- Vite build warning remains for large JS chunks from map/chart libraries.
- `npm ci` reports dev-tooling audit advisories; production audit is clean.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json` and `progress.md`.
3. Review this handoff.
4. Run `./init.sh` or the documented verification command before editing.

## Recommended Next Step

- Pick one unfinished feature from `feature_list.json`: `feat-004` verified station coordinates or `feat-005` performance split.
