# Policy #13 annual edition and original-byte audit

Dataset: `759db528-77b5-4aa3-b6fa-2b857890214e`, [official catalogue](https://data.taipei/dataset/detail?id=759db528-77b5-4aa3-b6fa-2b857890214e). Publisher: 臺北市政府環境保護局. Retrieval: `2026-10-27T00:13:36.437Z`; analysis cutoff `2026-10-27`.

| ROC / Gregorian | Independently verified resource ID | Official resource update (catalogue local time) | Bytes | Published | Observed | Future empty rows |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 112 / 2023 | `0e488a9c-7e44-4c30-bd07-049779218a76` | 2024-05-31 16:34:13 | 28176 | 192 | 192 | 0 |
| 113 / 2024 | `44524259-d419-4c95-aa6f-16d58f03d1c1` | 2025-01-10 11:35:14 | 28731 | 192 | 192 | 0 |
| 114 / 2025 | `4f2bf5d2-9561-471a-a53c-7da82dfac0e2` | 2026-01-02 17:30:37 | 28788 | 192 | 192 | 0 |
| 115 / 2026 | `a66f7820-35c0-42f4-af31-87c2401f3c12` | 2026-10-16 09:00:48 | 23858 | 192 | 144 | 32 |
| Total | Four accepted annual editions | | 109553 | 768 | 720 | 32 |

Official download URL for each ID is `https://data.taipei/api/frontstage/tpeod/dataset/resource.download?rid=<resource-id>`; exact URLs are stored in the manifest. Resource IDs are extracted from each official embedded resource object, not guessed from download ordering.

## Original-byte SHA-256

| Year | SHA-256 |
| --- | --- |
| 2023 | `6ccd7907164ab593ad60c123d764fb473420015f88afaeebb7d25459c1627fb6` |
| 2024 | `e71033568e29b1cffbc0babefd94ca66f653effd1488611d0b34028e03f04907` |
| 2025 | `b5114013df50d2e1fecb2ad446b8134c23858ad408af88f803a58d837664c8e3` |
| 2026 | `39ca05ac221eab632fde2b5d2e359b633d5ffa5fcb2a7ed40a70c8d3b0177f34` |

All annual files decode as Big5/CP950. Each has 31 columns: four identity fields and 27 indicator fields. Each has 16 distinct river/station labels and 192 station-month rows. No duplicate station-period identities or unparsed indicator cells occur in the accepted edition. The complete original header sequence is retained per annual source; 2025 and 2026 reorder metal columns, so processing must use exact named columns.

## Accepted qualifier distribution (27 indicators per published row)

| Year | Exact measured | Censored (`ND<` or `<`) | `---` not measured | Blank missing | Unparsed |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2023 | 2859 | 409 | 1916 | 0 | 0 |
| 2024 | 2838 | 430 | 1916 | 0 | 0 |
| 2025 | 2830 | 438 | 1916 | 0 | 0 |
| 2026 | 2157 | 294 | 1437 | 1296 | 0 |
| Total | 10684 | 1571 | 7185 | 1296 | 0 |

These sum to 20736 published indicator cells. A measurement-bearing row contains at least one exact or censored value; that does not make every indicator exact or suitable for RPI. `---` is a distinct nonmeasurement category, not a failed sample and not zero.

The accepted 2026 edition has January–September results (16 stations × 9 months = 144 rows). October has 16 empty rows within the current month and is explicitly incomplete/current-period evidence, not an overdue finding. November and December have 32 entirely empty future rows excluded from observed counts. Source edition and cutoff drive classification, so a later accepted edition can legitimately replace placeholders with measured results.

## Historical versus accepted editions

2023–2025 original bytes exactly match the existing river explorer's retained files. The historical 2026 file has 17651 bytes, SHA-256 `742b87d4f89a2ecd3abf256eba345a836131087f27e0162dea671fd1d224b5fd`, 192 published rows but only 80 measurement-bearing rows (January–May). Historical total actual observations are therefore 656, not 768. The accepted 2026 edition adds 64 measurement-bearing station-months (June–September) while preserving 192 published calendar rows. Historical future empty rows remain 32 under this analysis cutoff, but historical June–September absences must not be misrepresented as future months. The existing explorer data is preserved; Policy #13 uses its own accepted source lineage.

All original source files, contextual HTML and manifests are under `data/raw/river-water-policy/`. Public snapshot generation is offline and independent. Source hashes and analysis-date configuration must pass validation before snapshot publication; failed refresh/build cannot promote a partial edition.
