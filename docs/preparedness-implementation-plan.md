# Issue 7 implementation plan — 2026-10-19

One feature: `feat-021`, Heavy-Rain Preparedness & Infrastructure Review Decision Support.

Baseline: clean `main` at `bdbfbda`; branch `codex/heavy-rain-preparedness-review`.
Windows system Bash returned E_ACCESSDENIED; Git Bash also failed to launch.
Equivalent startup checks ran: npm ci (123 locked packages), convert:data,
npm test (43 passing tests and tsc), normal build and Pages build passed.
Existing warning: main bundle >500 kB. No new dependency is planned.

1. Audit only selected official resources; preserve bytes, hashes and source metadata.
   Validate KML/CRS, source periods, exclusions and edition choice. Publish a minimized,
   deterministic snapshot, retaining previous good output if validation fails.
2. District × infrastructure-category candidates, transparent independent evidence-gap
   tiers, stable ranking, capacity scenarios and same-population sensitivity.
3. Lazy bilingual dashboard with source health, context map, explanations, quality
   controls, shortlist comparison and non-sensitive JSON/CSV briefing.
4. GIS, governance, reproducibility and decision tests; desktop/mobile review;
   full existing checks and GitHub Pages compatibility.
5. Document methods and actual limitations; update ledger/handoff; commit using Lore
   trailers and prepare a reviewable PR without merging.

District fallback is intentional until official area coverage and catchment-to-asset
relationships support a stronger geography. Historical polygons never predict flooding;
facility records never establish capacity, current availability or protection.
