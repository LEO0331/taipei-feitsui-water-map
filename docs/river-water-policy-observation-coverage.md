# Policy #13 observation coverage audit

Method: `river-water-longitudinal-evidence-review-v1`. Fixed analysis date: **2026-10-27**, Asia/Taipei. Counts below describe the admitted 112–115 / 2023–2026 editions, rather than the older river explorer's retained extract. Source hashes and resource IDs are recorded in [the source audit](river-water-policy-source-audit.md); machine-readable results and selected IDs are in [the results file](river-water-policy-results.json).

## Units and denominators

A river, an official physical station, a station label, a station-month opportunity, a published CSV row, an observation-bearing row, one indicator cell, a paired observation, an RPI result and a river-wide summary are separate units. The CSV provides year and month; it does not justify an exact sampling day.

The official Taipei description specifies monthly sampling at 16 locations on nine rivers. The coverage grid therefore contains 16 source river/station identities × 48 calendar months = **768 published station-month rows**. This is schedule coverage, not measurement completeness. Commissioning/discontinuation dates and historical physical station continuity are unknown. The monthly-opportunity denominator is a disclosed assumption across the admitted years; absence never establishes that a station closed.

| Metric | Count | Interpretation |
| --- | ---: | --- |
| Published rows | 768 | 192 in each annual edition |
| Observation-bearing rows | 720 | At least one valid exact or censored indicator |
| Fully observed across all 27 indicators | 0 | Optional/unmeasured fields prevent full-field completeness |
| Partially observed across 27 indicators | 720 | Does not mean all four RPI inputs are absent |
| Exact, valid four-indicator potential input sets | 460 | Potential inputs, not admitted RPI outputs |
| Current-month rows with no measured indicators | 16 | October 2026 is still in progress at the cutoff |
| Future placeholders | 32 | November–December 2026, excluded from observed counts |
| Expected opportunities through October 2026 | 736 | Includes 16 current-month opportunities |
| Expected-to-date opportunities without an observation | 16 | All are current October rows; this is not an overdue-sample count |
| Prior-month missing opportunities | 0 | Within the assumed retained schedule |
| Duplicate station-period rows | 0 | No conflicting period group in accepted editions |
| Unparseable rows | 0 | Accepted edition audit |

The actual observed span is January 2023–September 2026. Published calendar coverage extends through December 2026. The current-month 16 and future-month 32 are different states. On a later accepted edition or analysis cutoff, classifications are rebuilt from the source cells and period, not permanently hard-coded to month numbers.

Each station has 48 published rows, 45 observation-bearing rows, 46 opportunities through the cutoff, one current-month empty row and two future placeholders. Thus 720/736 (97.83%) is observation-bearing coverage of the assumed through-cutoff opportunities; it is not 100% monitoring completeness, a laboratory quality rate, or an operating-status determination. Among fully elapsed months, the corresponding retained schedule has 720/720 observation-bearing rows, still subject to station-history assumptions and indicator-specific omissions.

## Indicator cells and censoring

All 27 published fields retain raw text, unit, qualifier, parsed finite number where appropriate, and detection limit where present. A cell's source and month come from its enclosing source-bound row. Across **20,736 cells**, there are **10,684 measured**, **1,571 censored**, **7,185 not measured**, **1,296 missing**, **0 unparsed** and **0 invalid exact numeric values**. The 1,296 missing cells are the 48 wholly empty rows × 27 fields. The raw qualifiers are not combined.

`ND<0.02` and `<10` are censored bounds. `---` is not measured. Blank is missing. Scientific notation remains numeric. No zero, half-limit, limit-value or mean imputation is applied. An exact-value eligibility count below establishes a usable cell, not verified historical comparability of a physical station.

| Indicator | Unit | Measured / exact cells | Censored | Not measured | Missing |
| --- | --- | ---: | ---: | ---: | ---: |
| Water temperature | °C | 720 | 0 | 0 | 48 |
| Air temperature | °C | 720 | 0 | 0 | 48 |
| pH | Dimensionless | 720 | 0 | 0 | 48 |
| Dissolved oxygen | mg/L | 720 | 0 | 0 | 48 |
| Biochemical oxygen demand | mg/L | 720 | 0 | 0 | 48 |
| Ammonia nitrogen | mg/L | 460 | 260 | 0 | 48 |
| Nitrate nitrogen | mg/L | 720 | 0 | 0 | 48 |
| Nitrite nitrogen | mg/L | 489 | 231 | 0 | 48 |
| Suspended solids | mg/L | 720 | 0 | 0 | 48 |
| Chemical oxygen demand | mg/L | 714 | 6 | 0 | 48 |
| Cadmium | μg/L | 15 | 225 | 480 | 48 |
| Chromium | μg/L | 95 | 145 | 480 | 48 |
| Copper | μg/L | 234 | 6 | 480 | 48 |
| Lead | μg/L | 135 | 105 | 480 | 48 |
| Zinc | μg/L | 240 | 0 | 480 | 48 |
| Iron | μg/L | 0 | 0 | 720 | 48 |
| Manganese | μg/L | 240 | 0 | 480 | 48 |
| Silver | μg/L | 0 | 240 | 480 | 48 |
| Nickel | μg/L | 172 | 68 | 480 | 48 |
| Mercury | μg/L | 0 | 240 | 480 | 48 |
| Arsenic | μg/L | 15 | 0 | 705 | 48 |
| Conductivity | μmho/cm | 720 | 0 | 0 | 48 |
| Total phosphorus | mg/L | 0 | 0 | 720 | 48 |
| Turbidity | NTU | 720 | 0 | 0 | 48 |
| Coliform | CFU/100mL | 675 | 45 | 0 | 48 |
| Chloride | mg/L | 720 | 0 | 0 | 48 |
| Total nitrogen | mg/L | 0 | 0 | 720 | 48 |

Every indicator has 768 published cells. Every indicator has zero unparsed and invalid exact cells in the admitted editions. Unit compatibility is checked against the official annual headers; concentrations cannot be negative and pH must be within 0–14. Unrecognized or invalid inputs remain unavailable for exact comparisons. No arithmetic average combines exact and censored observations.

## Station-specific four-input coverage

All rows below share the 48/45/46 published/observed/through-cutoff schedule counts described above. The last column counts valid exact DO, BOD5, SS and NH3-N sets only. Research RPI eligibility remains zero for every station, for the independent blockers in [the RPI methodology](river-water-policy-rpi-methodology.md).

| River | Source station label | Potential exact four-input periods |
| --- | --- | ---: |
| 雙溪 | 雙溪取水口 | 1 |
| 雙溪 | 復興橋 | 4 |
| 磺溪 | 磺溪橋 | 32 |
| 淡水河 | 臺北橋 | 45 |
| 景美溪 | 恆光橋 | 39 |
| 景美溪 | 景美橋 | 42 |
| 基隆河 | 承德橋 | 43 |
| 景美溪 | 萬福橋 | 43 |
| 雙溪 | 青礜溪 | 1 |
| 貴子坑溪 | 新貴子坑 | 5 |
| 磺溪 | 陽明山 | 4 |
| 基隆河 | 大直橋 | 43 |
| 基隆河 | 成功橋 | 43 |
| 新店溪 | 永福橋 | 42 |
| 山豬窟溪 | 山豬窟溪 | 28 |
| 磺港溪 | 大豐停車場 | 45 |

The unmatched `青礜溪` label is retained separately from the current official `菁礐溪` wording. No alias, relocation, coordinate or historical site continuity is inferred. Source-name rows are retained for documentary review even when strict longitudinal identity cannot be established.
