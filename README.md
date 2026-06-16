# Taipei Feitsui Reservoir Water Quality Map / 台北翡翠水庫水質地圖

Mobile-first bilingual web app for exploring Taipei Feitsui Reservoir water-quality monitoring data with hydrometeorological and reservoir-operation context.

The app is still primarily a water-quality station map. Hydrometeorological and reservoir-operation data are supporting context for dashboard comparison, not a replacement product, operational model, prediction system, or causal model.

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

## Coordinates

Source data does not provide coordinates. Coordinates are manually maintained in:

`public/data/station-locations.json`

Only entries with `coordinateStatus: "verified"` and numeric coordinates render as markers. `表水平均值` is a summary row and does not render as a marker. Weather-station coordinates are optional; when missing, weather data is shown in charts only.

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

Shared:

- `public/data/station-locations.json`

## Dashboard Limits

If only one month is loaded for a dataset, multi-month trend charts show a notice instead of implying a trend. The combined dashboard joins water-quality monthly records, hydrometeorological monthly summaries, and reservoir-operation monthly summaries by `period` for contextual comparison only.

## Deployment

The browser app reads static JSON from `public/data` and does not call Taipei Open Data at runtime. Build output from `npm run build` can be deployed to static hosting. The included GitHub Pages workflow builds with `GITHUB_PAGES=true` so assets use the `/taipei-feitsui-water-map/` project path.

## Disclaimer

This app presents public water-quality, hydrometeorological, and reservoir-operation monitoring values. It does not determine drinking-water safety, pollution status, operational decision quality, predictions, or causation. Official interpretation and announcements should come from the responsible authorities.
