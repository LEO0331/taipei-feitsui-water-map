# Issue 7 verification — 2026-10-19

Baseline: clean main `bdbfbda`, 43 tests and typecheck, normal/Pages builds passed.
Final snapshot: `sha256-d67edc57254ee273` (121,724 bytes).

| Check | Actual result |
| --- | --- |
| `bash ./init.sh` | Windows Bash E_ACCESSDENIED; Git Bash could not launch. Equivalent steps below ran. |
| `npm ci` | Passed; 123 locked packages installed. No dependency or lockfile changes. |
| `npm run convert:data` | Passed, including the new offline preparedness converter. |
| `npm run data:convert:preparedness` | Passed; deterministic snapshot 228 infrastructure records / 9 reference polygons. |
| `npm test` | 65 tests passed; zero failed/skipped; TypeScript check passed. |
| GIS/data tests | 8: KML, topology, coordinates, duplicates, missing fields, scope/version checks, previous-good preservation, offline fallback/reproducibility. |
| Decision tests | 13: tiers, independence, ranking, capacity, scenarios, strict/permissive historical evidence, provenance/export/privacy and malformed snapshot rejection. |
| Service-worker test | Network-first snapshot updates under the Pages base; invalid/offline refresh preserves cached version. |
| `npm run build` | Passed; module JS 36.80 kB (13.57 kB gzip), separate CSS 1.81 kB. |
| `GITHUB_PAGES=true npm run build` | Passed; `/taipei-feitsui-water-map/` paths retained. |
| `npm audit --omit=dev` | Zero production vulnerabilities. |
| Development advisories | Six existing advisories: one low, one moderate, four high. No dependencies introduced. |
| `git diff --check` | Passed. No lint script is configured; tsc and whitespace checks were used. |

Existing Vite warning remains: main map/chart bundle exceeds 500 kB. The decision UI
is separately lazy loaded; this task does not resolve the pre-existing bundle size.
No reservoir/ecology JSON is requested by the initial loader on a direct `#preparedness`
opening. Returning to another module triggers the existing loader; manually verified
by opening the 88-record pumping inventory, then returning to the new module.

## Actual browser checks

In-app browser on the local development server, desktop and 390×844 mobile:

- Chinese/English labels, controls, warnings and candidate verification questions.
- Final snapshot source table: 88/73/67 infrastructure; nine reference polygons;
  historical 695 accepted /44 rejected, actual observation period 1991–2025.
- District/category filters, custom zero capacity rejected and export disabled;
  reset restores strict evidence, all districts/categories, capacity five.
- Evidence-first five slots: five candidates, 12 candidate-specific questions,
  two districts. Balanced five: 15 questions across five districts.
- Flood focus with unlimited capacity: six candidates across two districts;
  other candidates explicitly excluded by strategy focus rather than capacity.
- Candidate details show translated source/date/operational/service questions;
  unknown availability does not establish failure.
- Map displays source points and reference outlines with base tiles disabled.
  Tables remain usable independently; map source eligibility follows engine input.
- Actual JSON and CSV downloads completed. Final downloaded JSON parsed locally:
  final snapshot ID and historical temporal coverage/source caveats were present.
- Temporary localhost test proxy deliberately returned HTTP 503. The visible
  failure state offered Retry; after restoring the test source, Retry loaded the
  complete module. Proxy and temporary files were removed after the check.
- Fresh final browser tab had zero error logs. An earlier development tab retained
  a React HMR warning caused by changing effect dependency shape during editing;
  it did not recur in the fresh/reloaded application.
- Mobile English title wraps; page scrollWidth 375px ≤ viewport 390px. Navigation
  and wide tables scroll within their own containers. No horizontal body overflow.

Screenshots: [desktop controls/map](preparedness-desktop.jpg),
[mobile](preparedness-mobile.jpg), [intentional failure state](preparedness-retry.jpg).
Visual verdict: 94/100 pass after correcting the standalone mobile title wrapping.
The development-only verdict is retained in ignored `.omx/state/preparedness/ralph-progress.json`.

Manual regression sampled existing navigation/pumping inventory; all existing modules
were covered by the unchanged pre-existing test suite and full builds, not individually
claimed as manually tested. Source GIS validation is conservative planar validation,
not survey or hydrological certification. Actual agency readiness remains unknown.
