# Taipei Feitsui Reservoir Water Quality Map / 台北翡翠水庫水質地圖

Mobile-first bilingual web app for exploring monthly Taipei Feitsui Reservoir water-quality monitoring data by sampling station.

## Purpose

This project presents public monthly monitoring values as a station map and lightweight trend dashboard. It is station-based monitoring data, not dense event data, so the app uses station panels, comparison charts, and time-series views rather than a heatmap.

## Data Source

- Dataset: `臺北翡翠水庫水質月報表`
- Taipei Open Data page: `https://data.taipei/dataset/detail?id=dd7001c8-7a87-4294-a52a-e2c14bc49d88`
- Sample API pattern: `https://data.taipei/api/v1/dataset/{RESOURCE_ID}?scope=resourceAquire`
- Uploaded sample CSV: `data/raw/feitsui-water/115年3月翡翠水庫水質月報表.csv`

The sample CSV is Big5/CP950 encoded. The converter attempts UTF-8 first and falls back to Big5 when needed.

## Value Parsing

The converter preserves the raw value and parses a separate numeric value:

- `ND`: not detected, numeric value is `null`
- `<10`: below the shown threshold, numeric value is `10`, qualifier is `less_than`
- `-`: missing or not measured, numeric value is `null`
- empty: missing, numeric value is `null`
- numeric strings: measured values

## Station Coordinates

The source CSV/API does not include latitude and longitude. Coordinates are maintained manually in:

`public/data/station-locations.json`

Only stations with `coordinateStatus: "verified"` and numeric coordinates render as map markers. Stations without verified coordinates appear in the unmapped station list. `表水平均值` is preserved as a summary row and is not rendered as a map marker.

## Scripts

Install dependencies:

```sh
npm install
```

Fetch additional Taipei Open Data resources into local raw JSON:

```sh
npm run fetch:data
```

The fetcher discovers resource IDs from the dataset page where possible and also reads manual IDs from:

`data/raw/feitsui-water/manual-resources.json`

Convert local CSV/API JSON files into frontend static JSON:

```sh
npm run convert:data
```

Generated files:

- `public/data/water-quality-records.json`
- `public/data/water-quality-summary.json`
- `public/data/water-quality-station-series.json`
- `public/data/water-quality-parameter-series.json`
- `public/data/station-locations.json`
- `public/data/conversion-report.json`

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

## Dashboard Limits

If only one month is loaded, multi-month trend charts show a notice instead of implying a trend. Import more monthly files or API resources to enable time-series analysis.

## Deployment

The browser app reads static JSON from `public/data` and does not call the Taipei Open Data API at runtime. Build output from `npm run build` can be deployed to any static hosting service.

## Disclaimer

This app presents historical monitoring values and relative changes from public data. It does not determine drinking-water safety. Official interpretation and announcements should come from the responsible authorities.
