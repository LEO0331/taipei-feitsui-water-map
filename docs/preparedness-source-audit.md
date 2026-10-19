# Preparedness source audit

Audit performed 2026-10-19. Catalogue metadata was read from official Taipei Open Data pages; selected resource bodies were retrieved in Node, their original bytes hashed with SHA256, and actual schema/geometry inspected. A successful HTTP response alone did not establish analytical eligibility. `data/raw/preparedness-decision/source-manifest.json` retains exact resource IDs, publication dates, retrieval time, byte lengths, hashes, CRS and local paths. The browser loads the cohesive static snapshot only.

## Integrated resources

| Source | Official dataset | Selected resource ID | Resource publication date | Source rows → admitted / excluded |
| --- | --- | --- | --- | --- |
| Pumping stations | [026cc0fa-cecc-4c78-b986-ead3b0c8b95b](https://data.taipei/dataset/detail?id=026cc0fa-cecc-4c78-b986-ead3b0c8b95b) | d1f9c6e0-5f72-4fc4-ac18-0b75ce0b002e | 2026-06-25 | 88 → 88 / 0 |
| Contracted machinery, 115年度/2026 only | [cdbc2677-7f23-42e5-9b83-a57ab9bee39c](https://data.taipei/dataset/detail?id=cdbc2677-7f23-42e5-9b83-a57ab9bee39c) | 0f4541e5-9f7c-406f-bbd4-3c22e6255465 | 2026-07-21 | 73 → 73 / 0 |
| Sedimentation basins | [03db6e0d-c6a6-400a-9e52-9b821c404c38](https://data.taipei/dataset/detail?id=03db6e0d-c6a6-400a-9e52-9b821c404c38) | a513c535-e903-4b69-9f5e-7ba6d7b6aa3d | 2024-12-18 | 67 → 67 / 0 |
| Official flood-prone reference areas | [08101966-7aca-48e0-a028-6da02ba1192e](https://data.taipei/dataset/detail?id=08101966-7aca-48e0-a028-6da02ba1192e) | db12426f-777c-48f0-90a8-bb582f39a33e | 2025-06-03 | 9 → 9 / 0 |
| Historical inundation observations | [8377b584-81e9-432d-b902-5b4e9978e6bc](https://data.taipei/dataset/detail?id=8377b584-81e9-432d-b902-5b4e9978e6bc) | dbed5503-d5fb-46d5-8701-7b591ac38c35 | 2026-09-30 | 739 → 695 / 44 |

The three existing infrastructure source files match the selected current official downloads byte-for-byte. The decision builder parses those raw files independently using an explicit field allowlist; it does not copy existing broad machinery `sourceValues`. Pumping/basin coordinates are transformed from the officially documented TWD97-TM2 zone 121, EPSG:3826 using existing `proj4` conversion. Machinery WGS84 coordinates are validated directly. All 228 admitted infrastructure records have interpretable source district labels and valid coordinate bounds. All 73 machinery records lack an interpretable record date; annual resource publication is recorded separately and does not fill that gap.

The existing machinery module merges two local resource editions first-wins and reports 73 rows. This module deliberately selects only the 2026 resource, independently yielding 73 rows; it does not mix the 2025 edition (`dd0f5ff1-d688-40f4-9a53-c5faaeca05a2`, published 2026-07-13). No contacts, responsible-officer names, contractor names or contractor metadata are copied into the new decision input or briefing. No operating condition or equipment availability is known. Pumping establishment dates are not maintenance evidence. Basin catchment-area units are absent from the CSV header and catalogue field description; area is omitted entirely from scoring and is never interpreted as detention volume.

## GIS and temporal findings

Both actual KML bodies use `http://www.opengis.net/kml/2.2`, longitude/latitude coordinates consistent with WGS84 and Polygon/MultiGeometry. The narrow build-time reader supports Polygon and MultiPolygon, retains numeric source precision, and rejects DTD/entity expansion, incomplete documents, unsupported geometry, missing/unclosed/degenerate rings, bounds failures and self intersections. There is no network XML/entity expansion and no new package. Holes are retained in raw bytes and conservatively excluded from analysis because full hole topology is not certified. Separate polygon components undergo planar edge-intersection and containment checks; overlapping or touching components are excluded conservatively. Bounds are an envelope sanity check; source district labels are not an independent spatial district-boundary verification.

The nine flood-prone reference polygons cover only 北投區 (4) and 士林區 (5). They are published as reference context, never drawn as invented district boundaries or property risk zones. Their absence in another district means unknown coverage, not absence of susceptibility. Candidate units remain districts/categories.

The historical resource contains 739 placemarks and 781 Polygon elements (some MultiPolygon observations). The conversion excludes 44 placemarks. Exclusion reasons overlap: 26 have no usable district/date, 5 self intersections, 4 uncertified polygon holes, 8 touching/overlapping polygon components, and 2 duplicate observation geometries. `conversion-report.json` retains source row indices and explicit reasons without household attributes. Geometry duplicate identity ignores ring starting vertex and orientation. Aggregation deduplicates district/date/geometry combinations; district counts remain **observations**, and the number of distinct dates is **not** a count of distinct storm events.

Validated observation dates span **1991-06-19 through 2025-10-19**. This differs from catalogue coverage (2015-05-01 through 2026-09-11). The KML document name contains `1140307` while the current catalogue resource date is 2026-09-30. These conflicts remain visible source limitations. Neither the publication date nor document filename is substituted for the actual FDATE values. The public output aggregates historical evidence by source-reported district and event date; addresses, depth values, area values and household-scale historical geometry are not republished or scored. Depth/area units were not independently established.

No spatial join, proximity-based service relationship, rainfall attribution or hydrological prediction is performed. All infrastructure records explicitly retain `operational_status_unknown` and `catchment_relationship_unverified` information gaps. These do not assert equipment failure or absence of protection.

## Investigated but excluded

- [Principal drainage catchments](https://data.taipei/dataset/detail?id=d8085d88-0a07-4fe6-86ec-8910954342ac), resource `947559f0-3467-4b68-bebe-19570129c449`, catalogue publication 2025-10-02: actual KML inspected in memory (80 placemarks/84 Polygon elements), versus catalogue description of 78 catchments. It has explicit `PS1_REGION`/`PS1_NAME`, but PS1_NAME can name multiple stations (for example `忠孝、成都、貴陽`), AreaCode can describe the whole city, and no stable cross-file station ID was adopted. This is evidence that a relationship may be established in future, not permission to infer it now. No catchment service relationship is included in this snapshot.
- Optional historical rainfall and station locations: no selected resource was acquired or integrated. No reservoir or rainfall input contributes to preparedness review tiers.
- 2025 machinery edition: excluded to keep one annual edition, as described above.

## Reproduction, failure handling and verification

```sh
# Explicit network acquisition of exactly the five listed resources;
# existing infrastructure files must match official bytes, never overwritten.
node --import tsx scripts/auditPreparednessSources.ts

# Offline reproducible snapshot build, validates stored hashes before processing.
node --import tsx scripts/buildPreparednessDecisionSnapshot.ts

node --import tsx --test tests/preparednessSpatial.test.ts
```

The acquisition writes hash-addressed immutable KML files and replaces the source manifest only after all five resources validate. Failed retrieval or changed existing infrastructure bytes retain the previous manifest and published snapshot. The offline builder validates everything before publishing; each output is replaced through a temporary file/rename and `snapshot.json` is last. The browser consumes one cohesive snapshot, not mixed companion reports. Corrupt hashes, unsupported edition mixes or malformed source schemas fail without replacing public outputs. Missing optional KML files produce explicit unavailable source states; with both KMLs absent, Mode A still has its inventory and Mode B becomes unavailable. No replacement geometry is invented.

`processedAt` is the successful audited input timestamp, fixed for offline rebuilds. The snapshot ID hashes all content including methodology/schema versions and source provenance. Offline rebuilds of identical stored inputs are byte-reproducible. A fresh network audit changes provenance scope even if content bytes are unchanged; scenario comparisons use a single snapshot version.

Eight targeted deterministic tests passed on 2026-10-19, including real-source counts, polygon/multipolygon parsing, self intersection/bounds/date checks, EPSG:3826 conversion, duplicate facility identity, missing coordinates/dates/unknown districts, exact reproducibility against the committed snapshot, explicit annual edition selection, minimized public fields, pinned resource identity/version rejection with previous-good preservation, and missing-KML fallback. TypeScript verification also passed at the source-lane checkpoint. Whole-application verification is recorded in the main progress artifacts.

Selected raw CSV/KML files use Git -text attributes to preserve their official byte hashes across operating systems. The selected machinery CSV is committed with the official CRLF bytes (the previous Git blob had normalized LF). Projected infrastructure longitude/latitude outputs are rounded to eight decimal places (about 1 mm) to remove platform-specific floating-point tails; official WGS84 source values and KML precision are unchanged.
Original raw sources are treated as binary diffs and exempt from whitespace cleanup: official CRLF and KML coordinate-line spaces are part of the preserved bytes, not authored code formatting.
