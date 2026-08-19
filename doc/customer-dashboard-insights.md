# Customer Advisory: Using the Taipei Water & River Dashboard

## Purpose

This note translates the dashboard into practical, real-world uses for a public-sector or operations customer. It is a decision-support and transparency tool, not a live control room, flood-warning service, water-safety certification, or emergency-dispatch system.

## What the current data can support

| Dashboard area | Useful operational question | Appropriate use | Do not use it for |
| --- | --- | --- | --- |
| River water quality | Which monitored rivers/stations merit a closer follow-up? | Prioritising field review, communicating long-term monitoring context, checking missing data | Public-health advice, pollution-source attribution, real-time warnings |
| Feitsui reservoir operation and hydrometeorology | What historical operation and weather context is available? | Internal trend exploration with dates and source labels | Current storage, drought/flood alerts, operating instructions |
| Sedimentation surveys | How has source-recorded reservoir capacity changed across periodic surveys? | Long-horizon asset and watershed discussion | Current usable storage, dredging decision, reservoir lifespan forecast |
| Pumping stations and contracted machinery sites | Where are permanent assets and historical/preparedness records located? | Map-based coordination, contact-data stewardship, gap-review workshops | Proof that machinery is on site, live availability, flood probability |
| Historical benthic ecology | Where were species recorded during the 2012–2015 survey? | Selecting locations for renewed ecological surveying and public education | Current biodiversity, river-health ranking, ecological impact claims |

## Practical insights from the loaded data

### 1. Separate the three time horizons in every briefing

The dashboard intentionally combines current-era recurring monitoring, periodic infrastructure statistics, and historical one-off surveys. A customer should make the time horizon visible in slide decks, public notices, and internal workflows:

- **Recurring monitoring:** river-water records cover 2023–2026 in the local dashboard dataset.
- **Periodic strategic survey:** the sedimentation survey spans 1984–2025, but observations are discrete survey periods rather than continuous readings.
- **Historical ecology:** the benthic survey covers 2014-05-28 to 2015-04-30 in the loaded records. It contains 199 observation records, 33 recorded species, 8 mapped survey locations, and one species marked as alien.

Recommendation: add a required `data date / update date / intended use` line to every exported chart or briefing. Do not place historical ecological points beside current water-quality charts without a clear date separation.

### 2. Use the machinery map for preparedness verification, not incident response

The contracted-machinery dataset contains 73 source records with validated coordinates across 10 districts, six source-derived equipment types, and four contractors. North Taipei districts have more recorded sites in this particular source extract (for example, Beitou has 19 and Shilin has 14), but this is **not** a danger ranking.

Recommended operating process:

1. Before flood season, export the filtered district list and verify the current contract, staging plan, equipment ID, access constraints, and contact channel with the responsible authority.
2. Maintain a separate restricted operational roster for real-time dispatch; do not repurpose the public dashboard as that roster.
3. Compare permanent pumping-station locations and contracted machinery sites in planning workshops only. Treat them as separate asset classes unless an official relationship is documented.
4. Keep personal mobile numbers out of public-facing material and exports by default.

### 3. Treat river-water measurements as a prioritisation signal

The dashboard's local river-water summary shows materially different long-run averages between river/station series. For example, the loaded series for Tamsui River has higher average suspended solids and coliform counts than several other series. This can justify a **question**—such as whether to inspect sampling coverage, upstream inputs, rain-event timing, or sewer/stormwater interfaces—but not a conclusion about cause, safety, or comparative “river health.”

Recommended next step: establish a recurring monthly review that flags (a) missing observations, (b) unusually high values relative to the same station's own history, and (c) event context such as rainfall. Assign investigation and evidence collection outside the public dashboard.

### 4. Renew ecology baselines before using them in investment choices

The historical benthic layer is spatially valuable: the loaded data records 25 species for the Tamsui River region, 18 for Xindian Creek, and 8 for Guandu Riverside Park. Surveyed abundance is also concentrated in the Tamsui River records (1,039 of 1,748 recorded organisms). Those figures describe past survey effort and observations—not present-day population, ecological quality, or comparative environmental performance.

Recommended next step: commission or coordinate a repeat survey using a documented sampling design at the eight historical locations. Keep the original taxonomy, location IDs, method, effort, and date; collect replicated samples where possible. Only then use a matched-method comparison for restoration or habitat-management evaluation.

### 5. Use sedimentation results for long-horizon conversations

The latest loaded sedimentation survey (2025 survey period) reports 377.333 million m³ remaining total storage capacity and 7.06% cumulative sedimentation rate. These are useful for strategic watershed, sediment-management, and asset-resilience conversations.

Recommended next step: pair each periodic survey review with a plain-language note describing survey method changes, uncertainty, and any revisions. Avoid converting the rate into a depletion date or a conclusion that dredging is required.

## Priority roadmap

### Next 30 days

- Establish dashboard ownership: one data steward for source refreshes and one business owner for public interpretation.
- Add a source-refresh checklist: source URL, publication date, coverage period, checksum/record count, conversion warnings, and approver.
- Create a public communications template that separates “historical”, “periodic survey”, and “latest recurring monitoring.”

### Next 90 days

- Validate the contracted-machinery records with the relevant authority before flood season; document changed IDs, contracts, sites, and public/private contact rules.
- Define a river-water exception-review protocol based on station-specific baselines and data completeness rather than citywide rankings.
- Scope a repeat benthic survey at the historical locations, including a consistent sampling-effort design.

### Next 12 months

- Publish a controlled data-refresh calendar and conversion-quality dashboard.
- Add a formal map-layer metadata register: coordinate reference system, spatial precision, coverage dates, source owner, refresh cadence, and prohibited interpretations.
- Measure whether dashboard insights led to completed field checks, refreshes, or surveys; avoid measuring success through raw map views alone.

## Review findings affecting customer use

1. **High priority — resilient loading:** the application currently loads many static files in one `Promise.all` in `src/App.tsx`. A missing optional module file can make the whole app fail to load. Split core startup data from optional tab data, and show a tab-specific unavailable state.
2. **High priority — performance:** the production JavaScript bundle remains above Vite's 500 kB warning threshold. Lazy-load map/chart-heavy panels by route/tab before wider public rollout on slower mobile networks.
3. **Medium priority — new ecology quality controls:** add conversion regression tests for TWD97 transformation, date parsing, duplicate source rows, and alien-field semantics. Record invalid/partial rows in a conversion report rather than only retaining them in the raw source.
4. **Medium priority — data provenance:** retain raw source snapshots and a machine-readable metadata file for every module. The new ecology data has a documented one-time-survey status; surface this explicitly in every export and future refresh.

## Customer guardrails

- The dashboard is not an emergency-response channel. Use official Taipei City reporting and emergency channels in an incident.
- Do not infer current flood risk, equipment availability, water safety, dam safety, or contractor performance from these datasets.
- Do not infer ecological improvement/deterioration from the historical benthic survey or raw counts with different sampling effort.
- Publish aggregated operational information by default; keep personal contacts and active dispatch details in the appropriate controlled system.

## Source basis

- Taipei City Open Data and the relevant Taipei City Government agencies.
- River ecology dataset: `4cb2cb61-1b3f-4c0f-894b-353266b8a06b`, documented as a one-time survey project; local dashboard coverage is 2014-05-28 to 2015-04-30.
- Dashboard values cited above are derived from the local static JSON files bundled with this repository at the time of this advisory.
