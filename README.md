# Taipei Feitsui Water Map

[繁體中文](README.zh-TW.md)

A mobile-first bilingual Vite + React + TypeScript application for exploring Taipei public water, river, ecology, infrastructure, and preparedness datasets.

The browser reads only versioned local static JSON from `public/data`. Taipei Open Data retrieval happens in Node scripts under `scripts/`; the production app makes no live Taipei Open Data request.

## Use and limits

This is an exploration and transparency tool. It is not an emergency-response system, flood-warning service, real-time water-condition feed, drinking-water safety determination, asset-availability register, or engineering design tool.

Always read each module's source date and interpretation notice. In particular, historical ecology, sedimentation surveys, and preparedness machinery records must not be represented as current conditions.

## Modules

Navigation is grouped to keep the interface usable on desktop and mobile.

| Category | Modules |
| --- | --- |
| Overview | Feitsui water quality, combined context dashboard, data table |
| Reservoir | Hydrometeorology, reservoir operation, sedimentation surveys, Carlson Trophic State Index |
| Rivers & Ecology | Taipei river water quality, historical benthic species survey, historical amphibian survey, historical butterfly survey |
| Urban Water & Preparedness | Pumping stations, contracted storm machinery sites, sedimentation basins, park water-safety equipment |
| Water Services | Taipei Water support to Taiwan Water, clear-water quality, business KPIs |

### Important historical datasets

- **Feitsui Reservoir Sedimentation Surveys** (`reservoir_sedimentation_surveys`): periodic survey results from 1984–2025; not current usable storage, drought risk, dam safety, or a lifespan forecast.
- **Taipei Riverside Benthic Ecology** (`4cb2cb61-1b3f-4c0f-894b-353266b8a06b`): one-time historical survey records; the local extract covers 2014-05-28 to 2015-04-30.
- **Taipei Riverside Amphibian Ecology** (`a9228b5e-84fc-4781-916c-6c3e186b9f0c`): one-time historical survey records; the official survey coverage is 2012-08-01 to 2015-05-31. It does not represent current species distribution.
- **Taipei Riverside Butterfly Ecology** (`679ae4e4-0fc2-4ac5-8db0-bab87990ada4`): one-time historical survey records; the official survey coverage is 2012-08-01 to 2015-05-31. It does not represent current butterfly distribution or biodiversity condition.
- **Storm and Heavy-Rain Contracted Machinery Sites** (`storm_rainfall_rented_machinery_sites`): source-recorded preparedness sites, not a live deployment or equipment-availability tracker.

## Data sources and processing

| Dataset area | Source / local pipeline |
| --- | --- |
| Feitsui water quality | `data/raw/feitsui-water/` → `convertFeitsuiWaterQuality.ts` |
| Hydrometeorology and reservoir operation | `data/raw/feitsui-hydromet/`, `data/raw/feitsui-operation/` → conversion scripts |
| River water quality | `data/raw/river-water-quality/` → `convertRiverWaterQuality.ts` |
| Pumping stations and sedimentation basins | Local CSV → TWD97-TM2 / EPSG:3826 to WGS84 conversion |
| River ecology and amphibians | Local CSV → TWD97-TM2 / EPSG:3826 to validated WGS84 conversion |
| Storm machinery | Official WGS84 source coordinates are validated before mapping |

Source values are retained where practical. Missing values, `ND`, `<` values, dashes, and malformed text are not silently converted to zero. Map markers are rendered only for validated coordinates.

## Commands

Install dependencies:

```sh
npm install
```

Run tests and TypeScript checking:

```sh
npm test
```

Build for production:

```sh
npm run build
```

Start the development server:

```sh
npm run dev
```

Convert all locally available source data:

```sh
npm run convert:data
```

Selected dataset commands:

```sh
npm run data:fetch:river-ecology
npm run data:convert:river-ecology
npm run data:fetch:amphibian-ecology
npm run data:convert:amphibian-ecology
npm run data:fetch:butterfly-ecology
npm run data:convert:butterfly-ecology
npm run data:fetch:storm-machinery
npm run data:convert:storm-machinery
npm run data:convert:reservoir-sedimentation-surveys
```

`npm run fetch:data` performs network I/O and can rewrite raw source files. Use it only when intentionally refreshing source data.

## Generated static data

The application caches key static assets through `public/sw.js`. Major outputs include:

- `public/data/water-quality-*.json`
- `public/data/river-water-quality-*.json`
- `public/data/river-ecology/{records,summary,sites,metadata}.json`
- `public/data/amphibian-ecology/{records,summary,sites,metadata}.json`
- `public/data/butterfly-ecology/{records,summary,sites,metadata}.json`
- `public/data/storm-rainfall-rented-machinery-sites/{records,metadata,sites}.json`
- `public/data/reservoir-sedimentation-surveys/{records,summary,conversion-report}.json`

## Deployment

The project builds as a static site. GitHub Pages builds with `GITHUB_PAGES=true`, preserving the `/taipei-feitsui-water-map/` base path.

## Documentation

- [Customer dashboard insights](doc/customer-dashboard-insights.md)
- [Traditional Chinese README](README.zh-TW.md)
- [Agent and project workflow](AGENTS.md)

## Contributing data changes

When adding or refreshing a dataset:

1. Preserve raw input under `data/raw/<module>/`.
2. Keep source parsing in a dedicated conversion script.
3. Validate dates, quantities, and coordinates conservatively.
4. Generate static outputs and update PWA cache entries.
5. Add regression coverage for the parser and rerun tests/build.
6. Update both README language versions in the same change.
