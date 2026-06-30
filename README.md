# Taipei Feitsui Reservoir Water Quality Map / 台北翡翠水庫水質地圖

Now includes Taipei River Water Quality Monitoring, Taipei pumping stations, and Taipei Water support-to-Taiwan-Water statistics / 新增臺北市河川水質檢測、水利設施抽水站與北水處支援台水月統計模組.

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

Shared:

- `public/data/station-locations.json`

## Dashboard Limits

If only one month is loaded for a dataset, multi-month trend charts show a notice instead of implying a trend. The combined dashboard joins water-quality monthly records, hydrometeorological monthly summaries, and reservoir-operation monthly summaries by `period` for contextual comparison only.

## Deployment

The browser app reads static JSON from `public/data` and does not call Taipei Open Data at runtime. Build output from `npm run build` can be deployed to static hosting. The included GitHub Pages workflow builds with `GITHUB_PAGES=true` so assets use the `/taipei-feitsui-water-map/` project path.

## Disclaimer

This app presents public environmental monitoring data for exploration and trend comparison. It does not represent real-time water quality, drinking-water safety judgment, pollution source attribution, operational decision quality, prediction, causation, or official enforcement basis.
