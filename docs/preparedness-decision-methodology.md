# Heavy-rain preparedness evidence review methodology

Methodology: `heavy-rain-preparedness-review-v1`. Configuration: `1.0.0`.
This module allocates hypothetical documentary/field-review slots. It does not estimate flood hazard, drainage capacity, equipment availability, people protected, or operational readiness.

## Input and geography

The published `public/data/preparedness-decision/snapshot.json` is the only browser input. Reproduction uses the snapshot version, processing timestamp, individual dataset/resource identifiers, publication/retrieval dates, versions and SHA256 values recorded in each briefing. A successful download alone does not establish verification. Source conversion and geometry auditing happen in Node scripts, outside this engine.

The review unit is one Taipei administrative district × infrastructure category (`pumping`, `machinery`, `basin`): 12 districts and 36 possible candidates. Filters reduce this fixed population explicitly. Validated official reference areas and historical district observations supply context; they do not define inferred service areas. District geography is retained because an authoritative asset-to-drainage-service relationship is not established. Polygon co-location, a nearby asset or a catchment area number does not prove service, protection or storage capacity.

Source-backed rows must match the candidate's district, category and source identity. Unassigned districts contribute no invented geography. Source identity requires dataset ID, resource ID, content hash and version. Strict mode accepts verified sources; permissive mode additionally accepts limited sources for infrastructure and admitted validated historical aggregates. Official flood-prone designation requires a verified source in both modes. Limited historical inputs remain explicitly limited and never count as a verified source type in ranking. Unavailable sources are excluded in both modes. The source ETL supplies the detailed provenance audit; the runtime boundary checks schema, source identity uniqueness, nonempty closed geometry shapes, known context districts and plausible verified coordinate bounds.

## Independent review questions and tiers

Each dimension counts at most once per candidate. Repeated missing fields or duplicate rows do not inflate a dimension. If the infrastructure source is unavailable or excluded, all its downstream missing fields collapse to one `source_failure` and the candidate is insufficient, rather than several independent questions.

| Code | Trigger | Meaning |
|---|---|---|
| `source_failure` | Essential source unavailable, incomplete identity, or excluded by filters | Verify source before documentary interpretation |
| `inventory_coverage` | Eligible source has no matching district/category records | Confirm coverage; absence of records does not mean no protection |
| `identity_geography` | Nonverified coordinates, invalid-coordinate or duplicate-identity flags | One combined source-integrity question |
| `temporal_version` | Unknown publication age, age above threshold, unknown/uncertain version, missing record/establishment date flags | One combined source-period question; age does not imply equipment condition |
| `operational_evidence` | Explicit unknown-operational-status flag on available records | Request inspection/availability evidence; unknown does not mean failure |
| `service_relationship` | Explicit unverified-catchment-relationship flag | Request authoritative drainage-service mapping |

These are distinct documentary questions, not independent statistical predictors. Flags describe missing evidence in published source fields; they do not assert a municipality lacks the corresponding operational records.

* **A:** eligible candidate with a validated official flood-prone reference designation and at least two distinct question dimensions. Historical observations alone cannot satisfy the designation requirement.
* **B:** eligible candidate with any verified official context or at least one material question, without satisfying A.
* **C:** eligible source-backed routine inventory without those conditions.
* **Insufficient:** essential infrastructure source unavailable/excluded, or flood mode lacks an eligible verified flood source.

Historical observation quantity never raises a tier on its own. Rows are reported as observations, not unique events. Asset counts never become capacity. Unknown operational status never becomes failure. Establishment age never becomes condition.

## Ranking and scenarios

Default ordering is tier A/B/C/insufficient, descending distinct question count, descending verified contributing source-type count, unresolved version first, descending known publication age, and finally ascending stable candidate ID using code-point comparison. Unknown publication age remains null and sorts after known ages at the age tie-break; it already contributes a temporal question. Age is measured against snapshot processing time, never the browser clock. Default stale threshold is 730 days.

* `gaps`: apply the ordering above to all eligible candidates.
* `balanced`: group that ordering by district, order districts by their highest-ranked candidate (stable district ID for ties), then select one candidate per district per round. Continue until capacity or population is exhausted. Within each district retain default ordering.
* `flood`: keep eligible candidates with verified official context, then use default ordering. A lack of such candidates returns an explicit unavailable reason, never a synthetic probability.

Capacity is unlimited or a positive safe integer, with 5 and 10 as UI presets. Capacity is capped by eligible population. Excluded results include both evidence-ineligible candidates and candidates outside scenario focus/capacity. Counts of selected questions are candidate review tasks, not unique citywide deficiencies; the same source-wide question may require review across multiple candidates.

Evidence mode remains usable when flood sources are unavailable. Flood mode requires an eligible verified flood-prone/historical source, or admitted limited historical aggregates under permissive settings; it never substitutes reservoir rainfall, reservoir level or proximity for an urban flood model. Flood context is used only when its source passes the active filters.

## Sensitivity and evidence scope

The evidence-scope key records snapshot version, all source versions/hashes, district/category population, review mode, evidence strictness and stale-source settings. Candidates from different keys cannot be mixed into one scenario. Comparing capacities or selection procedures on one key is a same-scope comparison. A filter, mode, geography or source version change is explicitly labeled a different evidence scope; its effects cannot be attributed solely to a policy assumption. Stable/added/removed selected IDs and changes in full ranking are reported.

Including stale/unknown-date sources is the default, with visible temporal questions. Excluding them rejects sources older than 730 days or without a usable publication date. Reset restores strict evidence requirements, all districts/categories, evidence mode, 730 days and inclusion of stale sources.

## Reproducibility, exports and limits

`buildCandidates` and `runScenario` are pure and do not mutate snapshots. Runtime geometry validation reuses the same `geometryIssue` audit as the ETL, rejecting self-intersections, holes without verified topology, and overlapping/touching/contained multipolygon components. `makeBriefing` includes selected/excluded candidate explanations, source provenance (including individual source limitations, publisher, CRS, schema and observed temporal coverage), inventory counts, quality questions, capacity, same-scope 5-vs-10 and gaps-vs-balanced comparisons, agency verification questions and limitations. JSON contains only explicitly selected aggregate/source fields. CSV contains selected and excluded candidates and a full reproduction-context JSON cell on every row, including limitations and unknown operational conditions. It quotes all cells and prefixes formula-leading/control-prefixed cells with an apostrophe. Raw facility names, officers, phone numbers and contractor contacts are never copied into the briefing.

Reproduce and verify with `npm run data:convert:preparedness`, `node --import tsx --test tests/preparednessDecision.test.ts`, `npm test`, and `npm run build`. The source-specific conversion command is documented alongside the data pipeline. The tests use deterministic fixtures for every tier, capacities and tie-breaks, round-robin coverage, source-failure collapse, source filters, fixed-population comparisons, flood fallback, no forecast/capacity claims, schema boundaries, immutability and export privacy/formula protection.

For the integrated snapshot, strict evidence mode with capacity 5 selects 北投區:machinery, 士林區:machinery, 北投區:basin, 士林區:basin and 北投區:pumping under `gaps`. These candidates combine official reference designation with operational/service-relationship evidence questions; machinery additionally has a temporal/version question. The same input/configuration with `balanced` selects 北投區:machinery, 士林區:machinery, 中山區:machinery, 信義區:machinery and 內湖區:machinery, spreading five review tasks across five districts. This comparison changes documentary coverage, not protection or safety. Capture the exported snapshot/source versions when reproducing after a refresh.

Future work requires authoritative operational records and drainage-service relationships; additional precision must follow validated official geography and evidence rather than inferred protection zones.
