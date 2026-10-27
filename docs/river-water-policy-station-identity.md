# Policy #13 station identity audit

The statistical unit is a source-bound **river label × station label × year-month opportunity**. A published CSV row, a measurement-bearing observation, one indicator cell, a comparable pair and an RPI observation are separate units. They cannot be substituted for each other in denominators.

The [official current station page](https://www.tldep.gov.taipei/Public/DetInformation/RiverQuality.aspx) describes monthly sampling at 16 fixed sites across nine rivers. Its retained HTML dropdown contains independently assigned UUID station values and 16 current labels. Annual CSVs do not publish those station UUIDs, commissioning dates, relocation histories, laboratory method IDs or exact sampling days. We retain official UUIDs in original evidence, but do not manufacture a historical UUID join from string resemblance.

| CSV river | CSV station | Current label match | Historical physical continuity |
| --- | --- | --- | --- |
| 淡水河 | 臺北橋 | Exact label | Unverified |
| 基隆河 | 成功橋 | Exact label | Unverified |
| 基隆河 | 大直橋 | Exact label | Unverified |
| 基隆河 | 承德橋 | Exact label | Unverified |
| 新店溪 | 永福橋 | Exact label | Unverified |
| 景美溪 | 萬福橋 | Exact label | Unverified |
| 景美溪 | 恆光橋 | Exact label | Unverified |
| 景美溪 | 景美橋 | Exact label | Unverified |
| 雙溪 | 雙溪取水口 | Exact label | Unverified |
| 雙溪 | 青礜溪 | **Unmatched**; current page says 菁礐溪 | Unverified |
| 雙溪 | 復興橋 | Exact label | Unverified |
| 磺溪 | 陽明山 | Exact label | Unverified |
| 磺溪 | 磺溪橋 | Exact label | Unverified |
| 貴子坑溪 | 新貴子坑 | Exact label | Unverified |
| 山豬窟溪 | 山豬窟溪 | Exact label | Unverified |
| 磺港溪 | 大豐停車場 | Exact label | Unverified |

Each river/station pair occurs in all four accepted annual CSVs. There are no observed cross-year river reassignments or alternate CSV spellings. This supports source-label continuity only. There is no evidence here that a station relocated or changed equipment; there is also insufficient documentary evidence to certify that none did. The unresolved `青礜溪` / `菁礐溪` difference changes both characters and is not silently normalized into a verified alias.

Stable station IDs are `station-` plus the first 16 hexadecimal digits of SHA-256 over exact raw river label, NUL separator, exact raw station label. Station-month candidate/source row identity additionally includes accepted edition, ROC/Gregorian year, month and original row position. Sequence numbers alone are insufficient. Exact original labels and source row numbers remain in lineage.

Machine-readable `stationAudit` in the accepted manifest records `identityStatus` (`label_verified` or `unmatched`), `physicalContinuity: "unverified"`, years, raw labels, evidence URLs and limitations. Offline source audit regenerates this result against original annual rows and official dropdown evidence. `label_verified` means a current official label match, not verified historical physical identity. Strict longitudinal methods must apply their independent physical-continuity/methodology gate.

Expected monthly opportunities use the disclosed current monthly schedule over the accepted annual window through the analysis cutoff. Because station commissioning/discontinuation dates are unknown, denominators are schedule assumptions, not evidence of uninterrupted historic operation. No operational cessation is inferred from a missing record.
