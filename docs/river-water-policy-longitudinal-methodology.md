# Policy #13 longitudinal and review-scenario methodology

Method ID: `river-water-longitudinal-evidence-review-v1`. Fixed cutoff: **2026-10-27**. This method supports documentary evidence review; it does not fit a trend model or estimate causal effects.

## Identity and statistical units

Source-bound row IDs retain source ID, original-byte SHA-256, CSV row number, Gregorian year/month and encoded raw river/station labels. The record also retains ROC year, source fields and a river+station identity. Sequence number alone is never the key. River name alone never joins stations.

The current official roster matches 15 source station labels. CSV `青礜溪` and current official `菁礐溪` remain unmatched; an apparent character variant is not sufficient alias evidence. Historical physical continuity, laboratory-method compatibility and commissioning history are unverified for all 16 source identities. Current-name matching establishes only a documented label relationship, not an unchanged physical location over time.

## Comparison contract and actual gates

Each comparison candidate is **station identity × indicator × adjacent-year window**. The retained windows are 2023–2024, 2024–2025 and 2025–2026. A pair joins the same calendar month in each year. Both sides must have a unique observed source row, a valid exact numeric value for the same indicator, compatible units and explicit source-bound IDs. Duplicate periods, missing/placeholder/unparsed rows, invalid values and censored cells are excluded. Censored values are never replaced by zero or a detection-limit fraction.

There are **1,296 investigated comparison windows** (16×27×3). Strict Mode B admits **0**, because historical physical station continuity and method compatibility are not established. **823 windows** support a separately labeled **limited same-label descriptive view**, containing **7,239 exact same-month indicator pairs**. The other **473 windows** lack enough supported limited evidence, including unmatched identity or no exact pairs. The 7,239 pairs are indicator-specific pairs and may reuse the same station-month rows across different indicators; they are not 7,239 independent samples or sampling events.

Limited eligibility requires an official current label match and at least one exact pair. It deliberately does not establish a complete annual comparison: each window displays matched count and `12 − matchedCount` excluded month opportunities. The 2025–2026 window can include only accepted observed 2026 months. One or a few pairs do not establish a trend. Pairwise numeric differences describe those retained cells only; no ordinary censored-data mean, annual trend direction, significance test, seasonal adjustment or intervention effect is produced. A complete year is never treated as equivalent to an incomplete year.

Research RPI comparisons remain unavailable under the independent method and common-sampling blockers in [the RPI methodology](river-water-policy-rpi-methodology.md). The indicator-comparison grain is not mixed with an RPI-comparison grain.

## Mode A documentary review

Mode A candidate grain is **one admitted source station identity × source month**. Multiple rows at that grain would be grouped and flagged as duplicates, preserving all row IDs. There are 768 published candidates, **736 eligible for current documentary review**, and **32 excluded future placeholders**. The 16 current-month empty rows remain pending opportunities; they are not overdue prior-month samples.

Tier A asks a primary identity/source question (for example an unmatched label, ambiguity, conflicting duplicates or invalid essential identity). Tier B asks a completeness or comparability question, including partial indicator coverage, censoring, unknown methods or pending current-month publication. Tier C is routine review with no material unresolved issue. In this edition the eligible population is **A=46, B=690, C=0**. The 46 Tier A candidates are the unmatched station's through-cutoff months; no tier population is fabricated. All 720 observed rows have unmeasured optional fields and unknown historical/method evidence. Tiers are administrative review priorities, never pollution severity.

## Deterministic strategies and capacity

Both strategies start from the exact same eligible candidate IDs under one configuration and always preserve A→B→C precedence and the leading documented issue-code precedence. Evidence Gaps First then orders by stable candidate ID. Balanced Monitoring Review chooses the least represented river, then least represented station, within the current tier and issue-precedence group; stable ID breaks remaining ties. No environmental-severity weights or invented budget estimates are used.

| Strategy | Slots | Eligible | Selected | Selected A/B/C | Rivers | Stations |
| --- | --- | ---: | ---: | --- | ---: | ---: |
| Evidence gaps | 5 | 736 | 5 | 5/0/0 | 1 | 1 |
| Balanced | 5 | 736 | 5 | 5/0/0 | 1 | 1 |
| Evidence gaps | 10 | 736 | 10 | 10/0/0 | 1 | 1 |
| Balanced | 10 | 736 | 10 | 10/0/0 | 1 | 1 |
| Evidence gaps | All | 736 | 736 | 46/690/0 | 9 | 16 |
| Balanced | All | 736 | 736 | 46/690/0 | 9 | 16 |

The two small-capacity strategies select the same rows because the single unmatched station occupies all Tier A candidates. Balancing does not bypass a higher-tier identity question to force geographic diversity. At capacity 5 the actual IDs are `A:station-b304f8239c8754ee:2023-01` through `A:station-b304f8239c8754ee:2023-05`; capacity 10 extends through `2023-10`. The exact complete ID lists, selection reasons, representation and unused capacity are recorded in [results JSON](river-water-policy-results.json) and briefings. All current default scenarios fill their requested slots; strict Mode B has zero selected and leaves 5 or 10 slots unused.

## Sensitivity, scope and exports

Strategy overlap compares actual selected IDs, with shared/added/removed arrays and eligible-population, selected-count and river/station representation changes. Default capacity-5 strategy overlap is five shared, zero added and zero removed IDs. All-capacity selections share the same 736 IDs even though order can differ.

Restricting Mode A to 2026 changes eligibility from 736 to 160 (10 A,150 B), with 32 future placeholders still excluded. Its capacity-5 selection is `A:station-b304f8239c8754ee:2026-01` through `2026-05`: zero shared, five added and five removed IDs compared with all years; population change −576. This is a scope change, not a same-population strategy effect. Strict-to-limited Mode B changes its evidence contract and population from zero to 823; that difference does not demonstrate improved environmental conditions.

UI filters disclose source/year/river/station/indicator scope, strict versus limited evidence and capacity. Stable scenario computation uses the fixed accepted snapshot, never wall-clock randomness. JSON and CSV briefings carry method, date, snapshot/hash, source editions, configuration, selected IDs, tiers/issues, qualifier/coverage state, comparison validity, RPI eligibility, exclusions and limitations. Formula prefixes and leading control characters are escaped; ordering is deterministic, output size is bounded and empty results are valid. No internal filesystem path, secret or regulatory-compliance label belongs in these public briefings.

Mode C is unavailable: monthly monitoring cells alone cannot establish pollution causation, intervention effectiveness, permit violations or public-health suitability. Agency sampling/laboratory records, historical station-location history, hydrologic/seasonal context, applicable standards and jurisdiction-specific official determinations are conclusion-specific prerequisites.
