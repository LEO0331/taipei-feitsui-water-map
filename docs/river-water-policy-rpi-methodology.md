# Policy #13 RPI method and admission decision

The official Ministry of Environment reference defines River Pollution Index as the arithmetic average of four **category points**: dissolved oxygen (DO), biochemical oxygen demand (BOD5), suspended solids (SS) and ammonia nitrogen (NH3-N), all in mg/L. It is not the arithmetic average of the four raw concentrations. See [the official RPI definition](https://wq.moenv.gov.tw/EWQP/zh/Encyclopedia/NounDefinition/Pedia_37.aspx) and [the supporting river-water explanation](https://water.moenv.gov.tw/Public/CHT/WQInfo/monitor_river.aspx). Original HTML bytes, hashes and retrieval evidence are retained in the separate Policy #13 source manifest.

## Official literal point table

The implementation's `officialRpiPoints` helper reproduces only the literal unambiguous table ranges. It does not silently close precision gaps or calculate an admitted RPI.

| Indicator (mg/L) | 1 point | 3 points | 6 points | 10 points |
| --- | --- | --- | --- | --- |
| DO | ≥6.5 | 4.6≤DO<6.5 | 2.0≤DO≤4.5 | <2.0 |
| BOD5 | ≤3.0 | 3.0<BOD5≤4.9 | 5.0≤BOD5≤15.0 | >15.0 |
| SS | ≤20.0 | 20.0<SS≤49.9 | 50.0≤SS≤100 | >100 |
| NH3-N | ≤0.50 | 0.50<NH3-N≤0.99 | 1.00≤NH3-N≤3.00 | >3.00 |

The reference displays RPI classes as S≤2.0, 2.0<S≤3.0, 3.1≤S≤6.0 and S>6.0. It cites a 2013 revision and laboratory reporting-digit guidance. Arbitrary decimal values in (4.5,4.6) DO, (4.9,5.0) BOD5, (49.9,50.0) SS and (0.99,1.00) NH3-N do not have literal category assignments in the displayed table. The table alone is insufficient to invent a rounding rule that assigns those values.

The helper's independent boundary expectations include DO 6.5→1, 4.6→3, 4.5→6, 2.0→6 and a value below 2.0→10; BOD5 3.0→1, 4.9→3, 5.0→6 and 15.0→6; SS 20.0→1, 49.9→3, 50.0→6 and 100→6; NH3-N 0.50→1, 0.99→3, 1.00→6 and 3.00→6. Intermediate precision-gap inputs, negative values, nonfinite values and other indicators return unavailable. These score-table checks validate the literal helper, not a completed official RPI reproduction.

## Current admission result

At fixed analysis date **2026-10-27**, the accepted annual CSVs contain:

- 768 published station-month rows and 720 observation-bearing rows.
- 460 rows with all four potential inputs present as valid exact numbers in compatible mg/L fields.
- 260 observation-bearing rows whose ammonia value is censored; no exact value is substituted.
- 48 rows without measured inputs: 16 current-month empty rows and 32 future placeholders.
- **0 admitted research-reproduced RPI observations; all 768 published rows remain excluded from RPI output.**

There are three independent blockers. The applicable official significant-digit and RPI rounding convention has not been independently admitted. The displayed category ranges leave precision gaps for arbitrary decimals. A monthly CSV row does not independently prove a common physical sampling event for all four fields, and no official published RPI result was matched to the admitted row. Therefore the dashboard and exports show an explicit unavailable state rather than calculating numbers with invented assumptions.

The 460 complete sets measure potential input completeness only. They do not override method or event-lineage gates. Even a censored value whose possible interval falls in one category is not admitted under this initial conservative exact-input policy. Missing, unparsed, incompatible-unit, duplicated or future-period inputs are never combined. No official environmental classification is assigned to a station or river from these potential sets.

## Evidence needed to enable reproduction

Obtain and retain the applicable official calculation/reporting specification, including input precision and tie/rounding behavior; verify common-sampling identity or the agency's documented period-combination rule; and establish independent official golden examples that match retained input records. A future method version must audit each eligible set, retain constituent values and assigned points, and distinguish a station-period result from a river-wide determination. It must label output **Research-reproduced RPI** unless independently matched to an official published value.

RPI does not establish a pollution source, a causal intervention effect, permit compliance, drinking-water or swimming safety, ecological damage causation, or conditions beyond the observed period. Reservoir CTSI is a separate measure and is not combined with RPI. Mode C remains unavailable without independent conclusion-specific evidence.
