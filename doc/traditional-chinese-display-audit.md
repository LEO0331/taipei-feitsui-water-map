# Traditional Chinese Display Audit

## Scope

Audit date: 2026-08-31

Reviewed the customer-facing React panels, grouped navigation, filters, chart titles, table headers, map popups, notices, export labels, and raw source-data handling.

## Rules applied

1. When `language === 'zh'`, interface labels, actions, descriptions, table headers, and status labels use Traditional Chinese.
2. Original source values are not translated or altered. This preserves official place names, species names, contractors, classifications, equipment IDs, telephone strings, dates, and measurement text.
3. Scientific names, standards, coordinate reference system identifiers (`TWD97`, `WGS84`, `EPSG:3826`, `EPSG:4326`), `CTSI`, CSV, and units such as `m³` are intentionally language-neutral technical notation.
4. English remains available only through the explicit English language selection.

## Corrections made in this audit

- Reservoir-operation filter labels and options now switch to Traditional Chinese: rainfall class, net-storage direction, water-level class, and missing values.
- Storm machinery map-popup field labels, directory columns, export columns, coordinate state, and pagination now switch to Traditional Chinese.
- Sedimentation-survey directory column labels and pagination now switch to Traditional Chinese.
- Chinese/English descriptions are retained for every major module; raw data continues to display exactly as supplied by the relevant authority.

## Data-display decisions

| Content type | Chinese interface behavior |
| --- | --- |
| Official Chinese location, district, park, species, and contractor values | Display original source text |
| Scientific species name | Display original Latin name, often italicized |
| English-only source value | Preserve source text; do not fabricate a translation |
| Empty, invalid, or unavailable value | Display `—` rather than zero or invented text |
| Historical survey date/range | Display the stored source/normalized date and historical-data notice |
| Chart data key | Localize the visible title, axis context, card label, and tooltip context; keep the internal key private |

## Remaining maintenance rule

When a module is added or changed, audit both language modes before release. Add visible labels using `text(language, traditionalChinese, english)` or `localize(language, traditionalChinese, english)`, rather than introducing unguarded English strings in JSX.
