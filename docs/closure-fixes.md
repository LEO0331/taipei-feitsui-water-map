# Closure corrections — 2026-11-03

Branch `codex/closure-water-cache-layout-notices` starts from published main `9b8c40996b217891c48c9e108a6730c2560d91c0`. These corrections are committed/pushed for review; this work does not merge or deploy them.

## Verified problems and corrections

- **P1 shared-origin cache deletion:** the water worker's activation removed every cache except its current cache, including sibling Pages apps. Cleanup now expires only names with its existing `feitsui-water-map-` ownership prefix and preserves the current version. A VM regression running the actual worker fails before and passes after. A real built-worker activation preserves seeded safety/portfolio caches and expires an old water cache.
- **P2 English overflow:** the nowrap English title caused page widths662/1839 at viewport390/1440. The title now wraps. The table-mode strip has its own horizontal scroll instead of expanding the page. Table modes and data-table scrolling have explicit keyboard focus targets; the bilingual title/content, charts, tables and CSV values remain intact. No global clipping or overflow hiding is used.
- **Runtime notice distribution:** the build produces `THIRD_PARTY_NOTICES.txt` and `runtime-license-inventory.json`, linked from the bilingual footer and precached for offline use. The inventory covers all52 installed lockfile packages whose dev flag is not true, including type-only or bundle-unused packages conservatively. It records exact installed name/version/path, declared metadata license, source file paths and SHA-256 values. License texts are preserved verbatim, including Hippocratic2.1 for react-leaflet/core, own/copied Portfolio MIT text, the version-pinned Victory37.3.6 wrapper license and all13 bundled vendor license files. Missing texts or mismatched versions fail the build. See licenses/README.md for supplemental provenance. This is notice preservation, not a license compatibility/use/ownership certification.

## Actual verification

- Locked npm ci, offline convert:data,100 tests plus TypeScript, root and Pages production builds pass.
- Exact npm run test:browser:85/85 pass, errors[], bilingual four-width Explorer/navigation/state/focus/chunk failure and unvisited offline map/chart checks.
- Additional production checks: EN/ZH at390/1440, operation and table document containment, keyboard horizontal table scrolling, corrected February inflow/outflow cards/table/downloaded CSV, zero page errors.
- Built worker preserves seeded sibling caches; the discoverable notices and52-package inventory are accessible offline with HTTP200. Notice artifact95,221bytes; Victory entry contains14 license sources.
- npm audit full/production:0. git diff --check passes. Raw/generated data, package manifests/lockfile and scientific calculations/coordinates remain unchanged. Converter timestamp/path/last-bit projection churn was inspected and excluded.

Evidence is retained outside the repository at `D:/Practice/audit-results/closure-fixes/taipei-feitsui-water-map/`. The existing788kB shared map/chart warning remains; no warning threshold, dependencies or analytical boundaries changed. Production hosting remains the prior main revision until separately published.
