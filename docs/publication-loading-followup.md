# Publication loading and readiness follow-up — 2026-11-02

Baseline: `e88e8114ae13e2534e8b6229960a1d0b926d3334`, including merged significant-zero correction PR #9. New work is isolated on `codex/publish-water-loading-readiness`.

## Changes

Fourteen inactive analytical panels load through React.lazy inside a content-only Suspense boundary. Header/navigation and the existing default map/charts remain available. Existing props, data loading, filters, exports and interpretation notices are unchanged.

The production build inserts emitted JS/CSS paths into the existing service-worker precache and derives its cache version from hashed asset names. This background installation preserves offline access to previously unvisited panels; it does not eagerly execute their code. Same-origin built JS/CSS cache matching tolerates `Vary: Origin` from the preview server. Data and cross-origin cache matching retain their existing rules.

The browser gate waits for visible chart/map locators before retaining the existing assertions. It adds inactive-panel loading assertions and actual offline first-unvisited map/chart checks. No arbitrary rendering sleeps or reduced assertion scope were introduced.

## Measured loading

Local Edge production Pages build, cold contexts, service workers blocked for transfer measurements. Summed requested JavaScript asset sizes; gzip totals are computed with Node gzip, not measured wire bytes. These are local byte measurements, not a field performance or deployment claim.

| Entry | Before JS bytes | After JS bytes | Before gzip | After gzip |
| --- | ---: | ---: | ---: | ---: |
| Default | 1,062,202 | 788,207 | 312,689 | 235,238 |
| Preparedness | 1,098,997 | 825,002 | 326,262 | 248,810 |
| River policy | 1,119,837 | 848,199 | 332,370 | 255,752 |

Default cold JS decreases 25.8% (gzip estimate 24.8%). Background PWA installation still downloads all build assets to preserve offline availability. The remaining shared default map/chart bundle exceeds Vite's 500 kB warning; further partitioning is deferred, and the warning threshold is unchanged.

## Verification

- Locked `npm ci`, offline `npm run convert:data`, `npm test` (98 tests plus TypeScript), root and Pages production builds pass.
- Exact `npm run test:browser` passes 85/85 checks with zero errors: both languages at 320/390/768/1440px, all 21 targets, focus/reduced motion/state retention/chunk failure, lazy loading and offline previously unvisited panels.
- Separate identical native-tab offline checks passed on archived baseline and final builds: English desktop1440 and Chinese mobile390; previously unvisited river ecology map and clear-water chart.
- Full and production npm audit: zero vulnerabilities. `git diff --check` passes.
- Source/data/lockfile unchanged. Reviewed converter timestamp/local path/last-bit projection churn was excluded. No source fetch, scientific reclassification, coordinate inference, dependency addition, redesign, merge or deployment.

Raw logs, browser measurements, offline cache inventories and baseline comparison are retained outside the repository in `D:/Practice/audit-results/publish-followup/taipei-feitsui-water-map/`.
