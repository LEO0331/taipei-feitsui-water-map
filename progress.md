# Session Progress Log

## Current State

**Last Updated:** 2026-06-26
**Session ID:** pumping-stations
**Active Feature:** none

## Status

### What's Done

- [x] Static Vite/React/TypeScript/Leaflet app exists with bilingual UI.
- [x] Local data conversion supports the uploaded Big5 CSV and fetched API JSON resources.
- [x] Generated public data currently contains 1,764 records across 126 periods.
- [x] GitHub Pages workflow exists and Pages-mode build is configured for `/taipei-feitsui-water-map/`.
- [x] Initial harness files were generated: `AGENTS.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`.
- [x] Code review fix pass completed for app runtime behavior, chart semantics, search, and fetcher robustness.
- [x] AI slop cleanup pass completed with regression tests first.
- [x] Hydrometeorological context feature completed while keeping the water-quality map as the main product.
- [x] Hydromet code-review follow-up completed: removed obsolete table code and added weekday/weekend plus date-range filters.
- [x] Reservoir operation context feature completed with static fetch/convert scripts, operation tab, combined dashboard, and table modes.
- [x] Taipei river-water module completed as a separate domain with four years of Big5 CSV data.
- [x] Taipei pumping-stations module completed with local UTF-8-SIG source, TWD97-to-WGS84 conversion, map markers, filters, nearby lookup, directory, charts, and interpretation limits.

### What's In Progress

- [x] Tailor and validate the harness for this repository.
  - Details: Replaced generic placeholders with project-specific scope rules, feature state, verification flow, and handoff notes.
  - Blockers: None.

### What's Next

1. Pick the next unfinished feature from `feature_list.json`.
2. Recommended next options: `feat-004` verified station coordinates or `feat-005` performance split.

## Blockers / Risks

- [ ] Station coordinates are intentionally missing until verified sources are added; map markers will not appear yet.
- [ ] Production build succeeds but Vite reports a large JS chunk from map/chart libraries.
- [ ] `npm ci` reports dev-tooling audit advisories; `npm audit --omit=dev` reports 0 production vulnerabilities.

## Decisions Made

- **Keep harness minimal**: Use root `AGENTS.md`, JSON feature state, a progress log, one init script, and one handoff file.
  - Context: This repo is a small static app; a larger multi-agent process would add overhead.
  - Alternatives considered: Deeper docs tree and benchmark reports; deferred until there is a recurring agent failure to solve.
- **Full verification includes Pages build**: `GITHUB_PAGES=true npm run build` is part of the harness.
  - Context: Deployment depends on correct subpath URLs.
  - Alternatives considered: Local-only build; insufficient for GitHub Pages changes.
- **Trend charts aggregate by month**: Dashboard trend charts now average the records passed into each chart by period.
  - Context: A single line over all station rows connected unrelated stations within the same month and could mislead users.
  - Alternatives considered: Multi-line per-station chart; deferred because it would add visual density and needs legend/selection design.
- **Fetcher tolerates partial resource failures**: `npm run fetch:data` records failed resource fetches in `resource-index.json` and continues.
  - Context: A single Taipei Open Data resource failure should not abort a full 135-resource refresh.
  - Alternatives considered: Fail-fast; too brittle for public data refreshes.
- **Cleanup stayed utility-focused**: The pass avoided splitting `src/App.tsx` into many files.
  - Context: The highest-risk slop was untested data behavior and duplicated utility/UI lists, not component boundaries.
  - Alternatives considered: Larger component extraction; deferred to avoid broad churn without design need.
- **Hydromet remains supporting context**: The title stays `台北翡翠水庫水質地圖`; hydromet data is shown in charts/tables and combined context only.
  - Context: Hydrometeorological rows are daily weather-station observations, not water-quality station records.
  - Alternatives considered: Adding hydromet to the map by default; rejected because coordinates are not verified.
- **Combined dashboard avoids causal claims**: It shows the comparison title and non-causation notice even when no shared period exists.
  - Context: Current fetched hydromet sample is 2026-01; water-quality data may not have a matching month in local resources.
  - Alternatives considered: Hiding the combined dashboard; rejected because the notice is required.
- **Hydromet daily filters are shared**: The hydromet charts and table use the same period, weekday/weekend, and ISO date-range filter state.
  - Context: The request calls out hydromet date range and weekday/weekend filters; filtering only the table would make charts disagree.
  - Alternatives considered: Native `type=date`; rejected after browser verification because plain controlled ISO text inputs update reliably and remain mobile-friendly.
- **Operation data stays contextual**: Operation records are shown in cards, charts, table rows, and combined comparisons, not on the station map.
  - Context: Operation rows are daily reservoir-operation observations, not water-quality station records.
  - Alternatives considered: Adding operation markers; rejected because the dataset has no station coordinates and the product remains a water-quality map.
- **River water quality stays separate**: River records use their own tab, filters, summaries, table, and optional location file.
  - Context: River and reservoir records have different sources, monitoring purposes, stations, fields, and value qualifiers.
  - Alternatives considered: Merging river rows into the reservoir table; rejected because it would erase source/type boundaries.
- **Support-to-TWC data is aggregated monthly**: The official annual CSVs contain daily `MM月DD日` rows, so conversion sums source water-volume values into monthly records for the requested statistics module.
  - Context: The dataset title and requested UI are monthly statistics, while source files are annual daily rows.
  - Alternatives considered: Rendering daily rows directly; rejected because it would contradict the module semantics and requested monthly/annual comparisons.

## Files Modified This Session

- `AGENTS.md` - Project-specific agent startup, scope, and done rules.
- `feature_list.json` - Current feature state and next scoped work.
- `progress.md` - Restartable session status.
- `session-handoff.md` - Next-session handoff template populated for current repo.
- `init.sh` - Standard verification entrypoint.
- `src/App.tsx` - Runtime resilience and corrected trend chart aggregation.
- `src/utils/waterQuality.ts` - Search terms for Chinese/English parameter and group labels.
- `scripts/fetchFeitsuiWaterResources.ts` - Per-resource fetch failure recording.
- `tests/waterQuality.test.ts` - Regression coverage for parser, filters, summary, and comparison behavior.
- `package.json` - Unit-test script added to `npm test`.
- `scripts/fetchFeitsuiHydrometResources.ts` - Local hydromet API fetcher.
- `scripts/convertFeitsuiHydromet.ts` - Hydromet conversion to static JSON.
- `src/types/hydromet.ts` and `src/utils/hydromet.ts` - Hydromet models and utilities.
- `tests/hydromet.test.ts` - Hydromet parser and aggregation regression tests.
- `src/App.tsx` - Monitoring tabs, hydromet dashboard, combined dashboard, and table modes.
- `src/data/i18n.ts` - Hydromet and tab translations.
- `src/App.tsx` - Hydromet weekday/weekend and date-range filters; obsolete table component removed.
- `src/data/i18n.ts` - Hydromet filter label translations.
- `src/types/operation.ts` and `src/utils/operation.ts` - Operation data models, parsing, aggregation, and period join utilities.
- `scripts/fetchFeitsuiOperationResources.ts` and `scripts/convertFeitsuiOperation.ts` - Operation raw-data fetch and static JSON conversion.
- `tests/operation.test.ts` - Regression tests for operation date/value parsing, aggregation, and combined joins.
- `src/App.tsx` and `src/data/i18n.ts` - Operation tab, charts, combined dashboard labels, and table modes.
- `public/sw.js` and `README.md` - Operation static-data cache and documentation.
- `src/types/riverWaterQuality.ts` and `src/utils/riverWaterQuality.ts` - River value semantics, records, summaries, and parser.
- `scripts/fetchRiverWaterQuality.ts`, `scripts/convertRiverWaterQuality.ts`, and `scripts/buildRiverWaterQualitySummary.ts` - River local source workflow and static outputs.
- `src/RiverWaterQualityPanel.tsx` - Bilingual river filters, cards, charts, optional verified map, and records table.
- `tests/riverWaterQuality.test.ts` - ND, missing, scientific notation, and ROC-year regression checks.
- `src/types/twcSupport.ts` and `src/utils/twcSupport.ts` - Support-to-TWC models, date/volume parsing, derived metrics, and summaries.
- `scripts/fetchTaipeiWaterSupportTwcMonthlyStatistics.ts`, `scripts/convertTaipeiWaterSupportTwcMonthlyStatistics.ts`, and `scripts/buildTaipeiWaterSupportTwcSummary.ts` - Official annual CSV fetch, daily-to-monthly conversion, and static summary generation.
- `src/TwcSupportPanel.tsx` - Bilingual support-to-TWC filters, cards, charts, data table, and no-coordinate/data-limit notices.
- `tests/twcSupport.test.ts` - Date parser, missing value, share, rolling-total, and year-over-year regression coverage.

## Evidence of Completion

- [x] Harness validation: `validate-harness` scored 100/100 overall with 5/5 in instructions, state, verification, scope, and lifecycle.
- [x] Full harness verification: `./init.sh` passed.
- [x] Data conversion: `npm run convert:data` converted 1,764 records across 126 periods.
- [x] Tests pass: `npm test` / `tsc --noEmit` passed.
- [x] Production builds pass: `npm run build` and `GITHUB_PAGES=true npm run build` passed.
- [x] Production audit: `npm audit --omit=dev` found 0 vulnerabilities.
- [x] Browser runtime check: app loaded with 126 period options and no console errors; Chinese search for `水庫表水` returned 5 reservoir-surface rows; `濁度` returned 14 latest-month rows.
- [x] Cleanup verification: `./init.sh` passed with 5 unit tests.
- [x] Harness validation after cleanup: 100/100.
- [x] Hydromet verification: `npm run fetch:hydromet` fetched/reused 1 resource; `npm run convert:data` produced 31 hydromet records and 1 hydromet period.
- [x] Current full verification: `./init.sh` passed with 10 unit tests, local build, and Pages build.
- [x] Browser smoke: hydromet tab showed 8 summary cards and daily charts; combined dashboard showed the non-causation notice; data table switched to 31 hydromet daily rows; English tab labels worked.
- [x] Code-review follow-up verification: `npm test` passed with 10 tests; `npm run build` passed; final `./init.sh` passed; `npm audit --omit=dev` found 0 vulnerabilities; harness validation scored 100/100.
- [x] Hydromet filter smoke: weekend range `2026-01-10` to `2026-01-18` returned exactly `2026-01-10`, `2026-01-11`, `2026-01-17`, and `2026-01-18` with 0 console errors.
- [x] Operation conversion: `npm run fetch:operation` fetched or reused 130 resources; `npm run convert:operation` generated 3,961 daily records across 130 periods.
- [x] Operation tests/build: `npm test` passed with 14 tests; `npm run build` passed with the known Vite chunk-size warning.
- [x] River conversion: 768 records from four Big5 files; 9 rivers, 16 stations, 48 year-month periods, and 0 unparsed values.
- [x] River tests/build: `npm test` passed with 16 tests; `npm run build` passed with the known Vite chunk-size warning.
- [x] River browser smoke: Chinese tab loaded 13 cards and 768 rows; 2026 + 新店溪 filtered to 12 rows; ND values remained visible; English labels worked; mobile body width stayed within 390px; 0 console errors.
- [x] Final river verification: plain `./init.sh` passed under the harness-selected Node 22; production audit found 0 vulnerabilities; harness validation remained 100/100.
- [x] Support-to-TWC conversion: fetched 11 official Big5 annual CSV resources and generated 127 monthly records from daily source rows.
- [x] Support-to-TWC verification: `npm test` passed with 22 tests, `npm run build` passed, full `./init.sh` passed including Pages build, `npm audit --omit=dev` found 0 vulnerabilities, and `git diff --check` passed.
- [ ] Support-to-TWC browser smoke: not completed because Playwright browsers are not installed locally and system Chrome launch was blocked in this sandbox.

## Notes for Next Session

Start with `AGENTS.md`, then `feature_list.json`, then this file. Do not call `npm run fetch:data` unless refreshing Taipei Open Data is part of the task because it rewrites many raw JSON files.
