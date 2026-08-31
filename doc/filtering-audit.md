# Filtering Audit

Audit date: 2026-08-31

## Contract

Every module-level filter must update its maps, cards, charts, tables, rankings, and exported rows. Dataset-level provenance such as source owner and published coverage may remain constant.

## Corrections

- Rebuilt sedimentation-basin summaries from filtered records before rendering cards and charts.
- Rebuilt pumping-station and park-water-safety summaries from filtered records.
- Rebuilt clear-water quality, Taipei Water support, business KPI, and CTSI summaries from filtered records.
- Rebuilt storm-machinery district chart data from filtered records.

## Verification approach

1. Each filter predicate includes all state dependencies.
2. Summary builders are now invoked with the filtered result where a displayed aggregate is filter-sensitive.
3. Existing regression coverage verifies aggregation behavior; CTSI coverage now explicitly checks a one-record filtered summary.
4. The full TypeScript test suite and production build are required after changes.

## Known scope boundary

Source metadata, static data quality reports, and historical-coverage notices are intentionally not recalculated by UI filters because they describe the source dataset rather than the selected view.
