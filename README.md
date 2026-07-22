# Taipei Feitsui Reservoir Water Quality Map / 台北翡翠水庫水質地圖

Now includes Taipei River Water Quality Monitoring, Feitsui Carlson Trophic State Index, Taipei pumping stations, Taipei sedimentation basins, Taipei Water support-to-Taiwan-Water statistics, treatment plant clear-water quality, Taipei Water business key metrics, and park water-safety facilities / 新增臺北市河川水質檢測、翡翠水庫卡爾森優養指數、水利設施抽水站、臺北市水利處沉砂池、北水處支援台水月統計、各淨水場清水水質、北水業務關鍵數據與公園水域安全設施模組.

Mobile-first bilingual app with separate Feitsui Reservoir and Taipei river-water modules. Reservoir and river records have different sources, monitoring purposes, and locations and are not merged into one station dataset.

## Data Sources

Water quality:

- Dataset: `臺北翡翠水庫水質月報表`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=dd7001c8-7a87-4294-a52a-e2c14bc49d88`
- Known API resource: `https://data.taipei/api/v1/dataset/4d71a495-d45f-4b28-a7c8-20f4acc55376?scope=resourceAquire`
- Uploaded sample CSV: `data/raw/feitsui-water/115年3月翡翠水庫水質月報表.csv`

Hydrometeorology:

- Dataset: `臺北翡翠水庫水文氣象月報表`
- Known API resource: `https://data.taipei/api/v1/dataset/27adec48-2a1e-4897-a285-86a01e6c15ff?scope=resourceAquire`
- Raw JSON directory: `data/raw/feitsui-hydromet/`

Reservoir operation:

- Dataset: `臺北翡翠水庫操作運轉月報表`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=e6189636-9972-4c65-8a8b-5607a867c6be`
- Recent known API resources are seeded in `data/raw/feitsui-operation/manual-resources.json`
- Raw JSON directory: `data/raw/feitsui-operation/`
- Module key: `feitsui_reservoir_operation_monthly_reports`
- Optional manually placed CSV directory: `data/raw/feitsui-reservoir-operation-monthly-reports/` (UTF-8-SIG, Big5, and CP950-compatible Big5 decoding)
- This is a static operation and hydrology exploration module. It has no map markers and does not represent real-time reservoir conditions, drought/flood status, water-supply decisions, or water-quality/safety judgments.

Feitsui Reservoir sedimentation surveys:

- Dataset: `臺北翡翠水庫淤積調查報告`
- Module key: `reservoir_sedimentation_surveys`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=8c4511a5-ea23-4978-b448-8cc91cdfe842`
- Static outputs: `public/data/reservoir-sedimentation-surveys/records.json` and `summary.json`
- Records retain source values in thousand cubic metres and normalize display values to cubic metres. They are periodic survey statistics, not real-time storage, water level, drought, dam-safety, dredging, or lifespan indicators; no map markers are generated.

River water quality:

- Dataset: `臺北市河川水質檢測`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=759db528-77b5-4aa3-b6fa-2b857890214e`
- Raw CSV directory: `data/raw/river-water-quality/`
- Uploaded files: ROC years 112–115, decoded as Big5/CP950 with UTF-8-SIG fallback
- ROC year is inferred from the leading year in each filename

Water infrastructure:

- Dataset: `臺北市水利處抽水站`
- Uploaded CSV: `data/raw/pumping-stations/臺北市水利處抽水站TWD97.csv` (UTF-8-SIG)
- TWD97-TM2(zone121) X/Y coordinates are converted to WGS84 for Leaflet markers
- Gregorian `YYYYMMDD` establishment dates, river-system/district/management-unit filters, and nearby-station lookup are supported
- The module does not represent real-time pumping status, flood-risk prediction, or emergency instruction

Sedimentation basin infrastructure:

- Dataset: `臺北市水利處沉砂池`
- Module key: `sedimentation_basin_facilities`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=03db6e0d-c6a6-400a-9e52-9b821c404c38`
- Raw CSV directory: `data/raw/sedimentation-basin-facilities/`
- Source `X坐標` / `Y坐標` values are TWD97-TM2 projected coordinates, not WGS84 latitude/longitude
- Conversion preserves source fields, converts coordinates to WGS84, validates Taipei-nearby bounds, and renders valid reference markers
- Catchment area is preserved as a source field for comparison; the app does not infer real-time drainage capacity, flood protection, facility maintenance, public access, engineering design, property risk, insurance risk, or safety advice

Water supply support statistics:

- Dataset: `臺北自來水事業處支援台水月統計表`
- Module key: `taipei_water_support_twc_monthly_statistics`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=ab446f19-0f95-4e55-b593-0eea8e447c7d`
- Raw CSV directory: `data/raw/taipei-water-support-twc-monthly-statistics/`
- Annual Big5 CSV resources are combined and aggregated into monthly records
- The source `日期` rows are daily `MM月DD日` entries; conversion infers the ROC year from each annual filename and sums source values by month
- Source field names say `水量` but do not explicitly state a unit, so the app preserves raw water-volume values and displays `水量` instead of inventing cubic meters
- First District Office and Twelfth District Office support volumes are kept separate and summarized by month and year
- This dataset has no coordinates; no map markers or geocoding are used
- The module does not represent real-time dispatch, water-condition alerts, rationing status, water-quality status, future support forecasts, or emergency instructions

Water safety facilities:

- Dataset: `臺北市各公園水域安全告示牌及救生設備位置資訊`
- Module key: `park_water_safety_equipment`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=cf0da6f2-4fd2-4fa0-b624-d703833ef2bc`
- Raw CSV directory: `data/raw/park-water-safety-equipment/`
- District/area CSV resources are fetched and combined into one static layer
- Source coordinate fields are preserved; TWD97-like coordinates are converted to WGS84 and WGS84-like coordinates are accepted defensively before Leaflet rendering
- Facility category parsing separates water-safety signs, lifebuoys, lifesaving equipment, rescue ropes/poles, combined records, and unknown/other records
- Equipment codes are preserved and searchable
- Valid converted coordinates render as map markers and support nearby lookup
- The module does not represent emergency dispatch, rescue guarantee, current equipment condition, swimming safety advice, water-quality status, or emergency instruction

Tap water and treated-water quality:

- Dataset: `臺北自來水事業處各淨水場清水水質`
- Module key: `tap_water_treatment_plant_clear_water_quality`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=ee8842ea-25a2-4cd2-a6c0-d50b37ab18d0`
- Raw CSV directory: `data/raw/tap-water-treatment-plant-clear-water-quality/`
- The UTF-8-SIG CSV wide table is converted into `資料月份 × 檢驗項目 × 淨水場或水源` long records
- Source period is parsed from filenames such as `115年4月` and resource coverage such as `114/5-115/4`
- Site columns map to 直潭、長興、公館淨水場 and 雙溪、士林、三角埔、頂北投、鹿角坑清 water-source fields
- Standard limits preserve raw text and parse upper bounds or ranges such as `2`, `6.0~8.5`, and `0.2~1.0`
- Method detection limits, measured values, source-reported zeroes, and missing `-` / `--` values are preserved separately from parsed numbers
- Standard comparisons are source-field comparisons only; they are not real-time safety, household tap-water, health-risk, or regulatory-enforcement conclusions
- No official coordinates are provided, so this module does not geocode, render dataset-generated map markers, or provide nearby lookup

Tap water operations and supply service:

- Dataset: `臺北自來水事業處業務關鍵數據`
- Module key: `tap_water_business_key_metrics`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=4487aa01-acc6-4c54-8bef-8d4d2dd6f1b2`
- Raw CSV directory: `data/raw/tap-water-business-key-metrics/`
- Big5/CP950 CSV rows are parsed as monthly utility operations records
- ROC compact months such as `11105` and `11504` are converted to Gregorian month keys such as `2022-05` and `2026-04`
- Metrics include water distribution, billed water, Taiwan Water support, direct drinking fountains, online water-quality monitoring stations, pressure, pipeline length, population, users, staffing, revenue, expense, surplus, assets, liabilities, and equity
- Derived ratios and rolling 12-month totals are generated from source fields and labeled as data-organization outputs, not official audit, rating, forecast, or performance conclusions
- No coordinates, addresses, districts, or facility points are provided, so this module does not geocode, render map markers, or provide nearby lookup
- The module does not represent real-time supply status, outage information, household water-use records, bill estimates, drinking-water safety, financial advice, investment advice, credit rating, or operational performance ranking

Reservoir trophic-state monitoring:

- Dataset: `臺北翡翠水庫卡爾森優養指數`
- Module key: `carlson_trophic_state_index`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=56adb2f7-3a86-4a2b-9b4a-610e6df247e5`
- Raw CSV directory: `data/raw/carlson-trophic-state-index/`
- Source agency: `翡管局`; official resource update date recorded as `2026-03-11`
- Annual ROC years are converted to Gregorian years; CTSI values, source indicators, year-over-year change, and rolling 3-year averages are generated as static records
- Summary files include min/max/average/median CTSI, trophic-state indicator counts, CTSI band counts, trend counts, and data-quality counters
- The source fields do not provide coordinates, addresses, stations, or facility points, so this module does not geocode, render map markers, or provide nearby lookup
- The module does not represent real-time water quality, drinking-water safety guarantees, tap-water quality, medical advice, pollution-source determination, complete water-quality results, emergency warnings, or official risk scoring

Water-quality data is monthly and station-based. Hydrometeorological data is daily and weather-station based. Reservoir-operation data is daily operation/hydrology context. The frontend reads local static JSON only; Taipei Open Data API fetching happens through local Node scripts.

## Parsing Rules

Water-quality values preserve the raw value and parse a separate numeric value:

- `ND`: not detected, numeric value is `null`
- `<10`: below the shown threshold, numeric value is `10`, qualifier is `less_than`
- `-`: missing or not measured, numeric value is `null`
- empty: missing, numeric value is `null`
- numeric strings: measured values

Hydrometeorological values preserve raw strings. Empty values, `null`, `undefined`, and `-` are missing. Wind direction is preserved as text and is not parsed as a numeric value.

Reservoir-operation values preserve raw strings. Empty values, `null`, `undefined`, and `-` are missing. Numeric strings with commas, such as `1,341,116`, parse to numeric values while preserving the original raw value.

River-water values preserve raw strings and qualifiers:

- `ND<0.02`: below detection limit; not treated as zero in averages
- `---`: not measured
- empty / `NaN`: missing
- scientific notation such as `6.50E+03`: measured numeric value
- other text: unparsed and recorded in the conversion report

## Coordinates

Source data does not provide coordinates. Coordinates are manually maintained in:

`public/data/station-locations.json`

Only entries with `coordinateStatus: "verified"` and numeric coordinates render as markers. `表水平均值` is a summary row and does not render as a marker. Weather-station coordinates are optional; when missing, weather data is shown in charts only.

River station coordinates are optional in `public/data/river-station-locations.json`. The file is empty by default. No automatic geocoding or invented coordinates are used.

## Commands

Install dependencies:

```sh
npm install
```

Fetch water-quality resources:

```sh
npm run fetch:water
```

Fetch hydrometeorological resources:

```sh
npm run fetch:hydromet
```

Fetch operation resources:

```sh
npm run fetch:operation
```

Check/download river-water resources:

```sh
npm run data:fetch:river-water
```

Fetch all:

```sh
npm run fetch:data
```

Convert local water-quality CSV/API JSON:

```sh
npm run convert:water
```

Convert local hydrometeorological API JSON:

```sh
npm run convert:hydromet
```

Convert local operation API JSON:

```sh
npm run convert:operation
```

Convert the operation module with its canonical report outputs (including local CSV files when present):

```sh
npm run data:convert:feitsui-operation-reports
```

Convert Feitsui Reservoir sedimentation-survey records:

```sh
npm run data:convert:reservoir-sedimentation-surveys
```

Convert local river-water CSV files and build summaries:

```sh
npm run data:convert:river-water
```

Fetch Taipei Water support-to-TWC annual CSV resources:

```sh
npm run data:fetch:twc-support
```

Convert Taipei Water support-to-TWC CSV files and build summaries:

```sh
npm run data:convert:twc-support
```

Fetch park water-safety equipment CSV resources:

```sh
npm run data:fetch:park-water-safety
```

Fetch treatment plant clear-water quality CSV resources:

```sh
npm run data:fetch:clear-water-quality
```

Fetch Taipei Water business key metrics CSV resources:

```sh
npm run data:fetch:tap-water-business
```

Fetch Feitsui Carlson trophic state index CSV resources:

```sh
npm run data:fetch:ctsi
```

Fetch sedimentation basin CSV resources:

```sh
npm run data:fetch:sedimentation-basins
```

Convert park water-safety equipment CSV resources:

```sh
npm run data:convert:park-water-safety
```

Convert treatment plant clear-water quality CSV resources:

```sh
npm run data:convert:clear-water-quality
```

Convert Taipei Water business key metrics CSV resources:

```sh
npm run data:convert:tap-water-business
```

Convert Feitsui Carlson trophic state index CSV resources:

```sh
npm run data:convert:ctsi
```

Convert sedimentation basin CSV files and build summaries:

```sh
npm run data:convert:sedimentation-basins
```

Convert all local raw data:

```sh
npm run convert:data
```

Run tests and typecheck:

```sh
npm test
```

Start local development:

```sh
npm run dev
```

Build for production:

```sh
npm run build
```

Preview production build:

```sh
npm run preview
```

## Generated Static Files

Water quality:

- `public/data/water-quality-records.json`
- `public/data/water-quality-summary.json`
- `public/data/water-quality-station-series.json`
- `public/data/water-quality-parameter-series.json`
- `public/data/conversion-report.json`

Hydrometeorology:

- `public/data/hydromet-daily-records.json`
- `public/data/hydromet-monthly-summary.json`
- `public/data/hydromet-parameter-series.json`
- `public/data/hydromet-conversion-report.json`

Reservoir operation:

- `public/data/operation-daily-records.json`
- `public/data/operation-monthly-summary.json`
- `public/data/operation-parameter-series.json`
- `public/data/operation-conversion-report.json`
- `public/data/feitsui-reservoir-operation-monthly-reports/records.json`
- `public/data/feitsui-reservoir-operation-monthly-reports/summary.json`
- `public/data/feitsui-reservoir-operation-monthly-reports/monthly-summary.json`
- `public/data/feitsui-reservoir-operation-monthly-reports/yearly-summary.json`

River water quality:

- `public/data/river-water-quality-records.json`
- `public/data/river-water-quality-summary.json`
- `public/data/river-water-quality-conversion-report.json`
- `public/data/water-dashboard-summary.json`
- `public/data/river-station-locations.json`

Taipei Water support to Taiwan Water:

- `public/data/taipei-water-support-twc-monthly-records.json`
- `public/data/taipei-water-support-twc-summary.json`
- `public/data/taipei-water-support-twc-annual-summary.json`
- `public/data/taipei-water-support-twc-conversion-report.json`

Park water-safety equipment:

- `public/data/park-water-safety-equipment-records.json`
- `public/data/park-water-safety-equipment-summary.json`
- `public/data/park-water-safety-equipment-conversion-report.json`

Feitsui Carlson trophic state index:

- `public/data/carlson-trophic-state-index.json`
- `public/data/carlson-trophic-state-index-summary.json`
- `public/data/carlson-trophic-state-index-latest.json`
- `public/data/carlson-trophic-state-index-conversion-report.json`
- `public/data/feitsui-water-summary.json`

Shared:

- `public/data/station-locations.json`

## Dashboard Limits

If only one month is loaded for a dataset, multi-month trend charts show a notice instead of implying a trend. The combined dashboard joins water-quality monthly records, hydrometeorological monthly summaries, and reservoir-operation monthly summaries by `period` for contextual comparison only.

## Deployment

The browser app reads static JSON from `public/data` and does not call Taipei Open Data at runtime. Build output from `npm run build` can be deployed to static hosting. The included GitHub Pages workflow builds with `GITHUB_PAGES=true` so assets use the `/taipei-feitsui-water-map/` project path.

## Disclaimer

This app presents public environmental monitoring and water-infrastructure data for exploration, trend comparison, and location lookup. It does not represent real-time water quality, real-time flooding warning, drainage-capacity guarantee, drinking-water safety judgment, facility maintenance status, public-access status, engineering design parameters, pollution source attribution, operational decision quality, prediction, causation, property or insurance risk, or official enforcement basis.
