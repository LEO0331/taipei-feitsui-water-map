# Policy #13 source feasibility

Analysis cutoff: **2026-10-27 (Asia/Taipei)**. Acquisition occurred at `2026-10-27T00:13:36.437Z`. Production reads accepted local static files; none of these URLs is a browser runtime dependency.

| Evidence | Official source | Admission and limits |
| --- | --- | --- |
| Annual monitoring records | [Taipei catalogue](https://data.taipei/dataset/detail?id=759db528-77b5-4aa3-b6fa-2b857890214e), dataset `759db528-77b5-4aa3-b6fa-2b857890214e` | All four annual CSVs independently located in catalogue embedded resource metadata and downloaded as original bytes. 2023–2026, 768 published rows; 720 measurement-bearing rows. |
| Monitoring context | [Taipei Environmental Quality Information](https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx) | Current monthly monitoring description, nine rivers and 16 station labels. One CSV/site spelling discrepancy; historical physical continuity and sampling-method consistency remain unverified. |
| RPI definition | [Ministry of Environment RPI definition](https://wq.moenv.gov.tw/EWQP/zh/Encyclopedia/NounDefinition/Pedia_37.aspx) | Four constituents, points 1/3/6/10 and arithmetic average published. Printed precision gaps and referenced reporting-digit rules require conservative eligibility. This source alone does not establish a rounding algorithm for all input precision. |
| RPI supporting context | [Ministry of Environment river monitoring](https://water.moenv.gov.tw/Public/CHT/WQInfo/monitor_river.aspx) | Independent official contextual explanation, retained separately. No legal compliance or causation determination. |

Publisher of the annual records: 臺北市政府環境保護局. Catalogue update frequency is monthly. The source labels a period by year and month; no exact sampling day is inferred. The ROC year is taken from the catalogue annual resource identity and checked against the filename; `Gregorian = ROC + 1911`.

## Acquisition and admission

`npm run data:fetch:river-water-policy` performs an offline audit by default. `--refresh` explicitly authorizes scoped network staging. Review the printed staged manifest and use `--accept=<staged-sha256>` to accept those exact bytes offline. `--refresh --accept` is also supported for an explicitly authorized initial acquisition/admission. These commands never call the broad `fetch:data` pipeline and never replace the original river explorer CSVs.

Every fetched CSV and contextual HTML has a content-addressed filename. Hash, byte length, source URL and retrieval time are stored in `data/raw/river-water-policy/source-manifest.json`. Immutable `manifest-<sha256>.json` records retain prior admissions; the accepted manifest is replaced by atomic rename only after all selected files pass validation. A failed HTTP response, decode, schema, year, catalogue identity or byte check leaves accepted sources and the previously built public snapshot intact. Unaccepted staged bytes are evidence only, not an admitted analysis population.

Offline audit checks all original hashes, catalogue-bound resource identities/update times, exact indicator column names and units, finite valid months, row identity fields, stored count distributions and the station audit against retained official HTML. Order changes in the 2025 indicator columns are handled by names, never by positional assumptions.

## Feasibility decision

Mode A documentary monitoring review is supported by real annual rows and their qualifiers. Current-label evidence supports distinguishing 15 matching labels and one unresolved spelling, not proving historical physical station identity. Strict cross-year Mode B must respect that gap. Mode C causation, safety and regulatory determinations remain unavailable without independent evidence. No more permissive method is introduced merely to populate a review tier or trend table.
